/**
 * GET /api/member-votes?personID=X&limit=20
 *
 * Returns the member's voting history (K16–K24 from Knesset OData).
 * On first call for a member, fetches from Knesset API and caches in DB.
 * Subsequent calls are served entirely from DB.
 *
 * Note: K25 voting data is not yet published in the Knesset OData votes service.
 *
 * vote_result codes: 1=for 2=against 3=abstain 4=absent 0=cancelled
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const VOTES_BASE = 'https://knesset.gov.il/Odata/Votes.svc';

async function vFetch<T>(path: string): Promise<T[]> {
  const url = `${VOTES_BASE}/${path}${path.includes('?') ? '&' : '?'}$format=json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Votes API ${res.status}: ${path}`);
  const data = await res.json();
  return (data?.value ?? []) as T[];
}

async function syncMemberVotes(personID: number): Promise<number> {
  const paddedID = String(personID).padStart(9, '0');

  // Fetch all votes for this member — paginate since API caps at 100/page
  type VoteRow = { vote_id: number; kmmbr_id: string; vote_result: number; knesset_num: number };
  const memberVoteRows: VoteRow[] = [];
  const PAGE = 100;
  let skip = 0;
  while (true) {
    const page = await vFetch<VoteRow>(
      `vote_rslts_kmmbr_shadow?$filter=kmmbr_id eq '${paddedID}'&$select=vote_id,kmmbr_id,vote_result,knesset_num&$orderby=vote_id desc&$top=${PAGE}&$skip=${skip}`
    );
    memberVoteRows.push(...page);
    if (page.length < PAGE) break;
    skip += PAGE;
  }

  if (memberVoteRows.length === 0) {
    // Mark as synced with 0 votes (so we don't retry)
    await supabaseAdmin.from('vote_sync_log').upsert({ person_id: personID, vote_count: 0, synced_at: new Date().toISOString() }, { onConflict: 'person_id' });
    return 0;
  }

  const voteIDs = memberVoteRows.map(r => r.vote_id);

  // Fetch headers for these vote_ids in batches (OData URL length limit)
  const BATCH = 50;
  const headers: {
    vote_id: number;
    knesset_num: number;
    sess_item_dscr: string | null;
    vote_item_dscr: string | null;
    vote_date: string | null;
    vote_time: string | null;
    is_accepted: number | null;
    total_for: number | null;
    total_against: number | null;
    total_abstain: number | null;
  }[] = [];

  for (let i = 0; i < voteIDs.length; i += BATCH) {
    const chunk = voteIDs.slice(i, i + BATCH);
    const filter = chunk.map(id => `vote_id eq ${id}`).join(' or ');
    try {
      const rows = await vFetch<typeof headers[number]>(
        `View_vote_rslts_hdr_Approved?$filter=${filter}&$select=vote_id,knesset_num,sess_item_dscr,vote_item_dscr,vote_date,vote_time,is_accepted,total_for,total_against,total_abstain`
      );
      headers.push(...rows);
    } catch { /* skip failed batch */ }
  }

  // Upsert vote headers
  if (headers.length > 0) {
    const headerRows = headers.map(h => ({
      vote_id:       h.vote_id,
      knesset_num:   h.knesset_num,
      vote_date:     h.vote_date ? h.vote_date.substring(0, 10) : null,
      vote_time:     h.vote_time ?? null,
      description:   h.sess_item_dscr ?? null,
      item_desc:     h.vote_item_dscr ?? null,
      is_accepted:   h.is_accepted === 1,
      total_for:     h.total_for ?? 0,
      total_against: h.total_against ?? 0,
      total_abstain: h.total_abstain ?? 0,
    }));
    await supabaseAdmin.from('vote_headers').upsert(headerRows, { onConflict: 'vote_id' });
  }

  // Upsert member votes
  const knownHeaderIDs = new Set(headers.map(h => h.vote_id));
  const mvRows = memberVoteRows
    .filter(r => knownHeaderIDs.has(r.vote_id))
    .map(r => ({
      person_id:   personID,
      vote_id:     r.vote_id,
      vote_result: r.vote_result,
      knesset_num: r.knesset_num,
    }));

  if (mvRows.length > 0) {
    await supabaseAdmin.from('member_votes').upsert(mvRows, { onConflict: 'person_id,vote_id' });
  }

  await supabaseAdmin.from('vote_sync_log').upsert({
    person_id: personID,
    vote_count: mvRows.length,
    synced_at: new Date().toISOString(),
  }, { onConflict: 'person_id' });

  return mvRows.length;
}

export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const personID = Number(searchParams.get('personID'));
  const limit    = Math.min(100, Math.max(5, Number(searchParams.get('limit') ?? '20')));

  if (!personID) return NextResponse.json({ error: 'personID required' }, { status: 400 });

  // Check if already synced
  const { data: syncEntry } = await supabaseAdmin
    .from('vote_sync_log')
    .select('vote_count, synced_at')
    .eq('person_id', personID)
    .single();

  // Sync if: first time, OR previous sync was capped at exactly 100 (old bug — API paginates at 100)
  const likelyCapped = syncEntry && syncEntry.vote_count > 0 && syncEntry.vote_count % 100 === 0;
  if (!syncEntry || likelyCapped) {
    try {
      await syncMemberVotes(personID);
    } catch (err) {
      console.error('Vote sync failed for', personID, err);
    }
  }

  // Fetch from DB (votes + accurate total count)
  const [{ data: rows, error }, { count: totalCount }] = await Promise.all([
    supabaseAdmin
      .from('member_votes')
      .select(`
        vote_id,
        vote_result,
        knesset_num,
        vote_headers(vote_date, description, item_desc, is_accepted, total_for, total_against, total_abstain, knesset_num)
      `)
      .eq('person_id', personID)
      .order('vote_id', { ascending: false })
      .limit(limit),
    supabaseAdmin
      .from('member_votes')
      .select('*', { count: 'exact', head: true })
      .eq('person_id', personID),
  ]);

  if (error) {
    return NextResponse.json({ votes: [], synced: !!syncEntry, error: error.message });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawVotes = (rows ?? []).map((r: any) => {
    const h = Array.isArray(r.vote_headers) ? r.vote_headers[0] : r.vote_headers;
    return {
      voteID:       r.vote_id,
      knessetNum:   h?.knesset_num ?? r.knesset_num,
      date:         h?.vote_date ?? null,
      billName:     h?.description ?? null,   // sess_item_dscr — the actual agenda item title
      voteAction:   h?.item_desc ?? null,     // vote_item_dscr — "אישור החוק", "הסתייגות", etc.
      result:       r.vote_result as 0 | 1 | 2 | 3 | 4,
      isAccepted:   h?.is_accepted ?? null,
      totalFor:     h?.total_for ?? 0,
      totalAgainst: h?.total_against ?? 0,
      totalAbstain: h?.total_abstain ?? 0,
    };
  });

  // ── Lazy-enrich votes with missing bill names (up to 20 at a time) ──────────
  const missingIDs = rawVotes
    .filter(v => !v.billName)
    .slice(0, 20)
    .map(v => v.voteID);

  if (missingIDs.length > 0) {
    try {
      const filter = missingIDs.map(id => `vote_id eq ${id}`).join(' or ');
      const fresh = await vFetch<{
        vote_id: number;
        sess_item_dscr: string | null;
        vote_item_dscr: string | null;
      }>(
        `View_vote_rslts_hdr_Approved?$filter=${filter}&$select=vote_id,sess_item_dscr,vote_item_dscr`
      );

      // Build a lookup map and update DB rows
      const lookup = new Map(fresh.map(f => [f.vote_id, f]));
      const updates = fresh
        .filter(f => f.sess_item_dscr)
        .map(f => ({
          vote_id:     f.vote_id,
          description: f.sess_item_dscr ?? '',
          item_desc:   f.vote_item_dscr ?? '',
        }));

      if (updates.length > 0) {
        await supabaseAdmin
          .from('vote_headers')
          .upsert(updates, { onConflict: 'vote_id' });
      }

      // Patch the in-memory response
      for (const v of rawVotes) {
        const f = lookup.get(v.voteID);
        if (f) {
          if (f.sess_item_dscr) v.billName   = f.sess_item_dscr;
          if (f.vote_item_dscr) v.voteAction = f.vote_item_dscr;
        }
      }
    } catch { /* non-fatal — return what we have */ }
  }

  return NextResponse.json({
    votes: rawVotes,
    synced: true,
    voteCount: totalCount ?? rawVotes.length,
    note: 'K25 voting data is not yet available in the Knesset Open Data API',
  });
}
