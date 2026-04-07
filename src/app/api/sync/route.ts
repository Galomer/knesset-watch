/**
 * POST /api/sync?type=<type>
 *
 * Sync types:
 *   members        — current K25 MKs + factions (~10s, safe to re-run)
 *   members-all    — all MKs who served in K20–K25 (~20s)
 *   bills-k25      — ALL K25 bills + initiators, resumable (~30 min total, 50s/call)
 *   bills-historical — K20–K24 bills + initiators, resumable (~30 min total, 50s/call)
 *   daily          — incremental: bills updated in last 48h + current members
 *   full           — members + passed bills (quick baseline, same as before)
 *
 * Resumable syncs (bills-k25, bills-historical) save progress to sync_progress table.
 * Call them in a loop until response contains "done": true.
 *
 * Protected by: Authorization: Bearer <SYNC_SECRET or CRON_SECRET>
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchRealMembers, CURRENT_KNESSET, FACTION_ENG, COALITION_FACTION_IDS, BILL_STATUS } from '@/lib/knesset-api';

export const maxDuration = 60;

const BASE = 'https://knesset.gov.il/Odata/ParliamentInfo.svc';

async function kFetch<T>(path: string): Promise<T[]> {
  const url = `${BASE}/${path}${path.includes('?') ? '&' : '?'}$format=json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`Knesset API ${res.status}: ${path}`);
  const data = await res.json();
  return (data?.value ?? []) as T[];
}

function isAuthorized(req: Request): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  return token === process.env.CRON_SECRET || token === process.env.SYNC_SECRET;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getProgress(id: string) {
  const { data } = await supabaseAdmin
    .from('sync_progress')
    .select('*')
    .eq('id', id)
    .single();
  return data as { id: string; last_skip: number; total_synced: number; is_done: boolean } | null;
}

async function saveProgress(id: string, lastSkip: number, totalSynced: number, isDone: boolean) {
  await supabaseAdmin.from('sync_progress').upsert({
    id,
    last_skip: lastSkip,
    total_synced: totalSynced,
    is_done: isDone,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
}

async function upsertBillsPage(
  page: { BillID: number; Name: string; StatusID?: number | null; SubTypeID: number | null; PublicationDate: string | null; LastUpdatedDate?: string | null }[],
  knessetNum: number,
  overrideStatusId?: number,  // only set when we already know status (e.g. passed-only query)
) {
  if (page.length === 0) return;
  const rows = page.map(b => {
    const sid = overrideStatusId !== undefined ? overrideStatusId : (b.StatusID ?? null);
    return {
      bill_id: b.BillID,
      name: b.Name ?? null,
      knesset_num: knessetNum,
      status_id: sid,
      status_desc: sid !== null ? (BILL_STATUS[sid]?.he ?? null) : null,
      is_government: b.SubTypeID === 53,
      publication_date: b.PublicationDate ? b.PublicationDate.substring(0, 10) : null,
      last_updated_date: b.LastUpdatedDate ?? null,
      updated_at: new Date().toISOString(),
    };
  });
  const { error } = await supabaseAdmin.from('bills').upsert(rows, { onConflict: 'bill_id' });
  if (error) throw new Error(`Bills upsert: ${error.message}`);
}

async function upsertInitiators(billIDs: number[], validPersonIDs: Set<number>) {
  if (billIDs.length === 0) return 0;
  let count = 0;
  for (let i = 0; i < billIDs.length; i += 25) {
    const chunk = billIDs.slice(i, i + 25);
    const idFilter = chunk.map(id => `BillID eq ${id}`).join(' or ');
    try {
      const rows = await kFetch<{ BillID: number; PersonID: number; IsInitiator: boolean }>(
        `KNS_BillInitiator?$filter=${idFilter}&$select=BillID,PersonID,IsInitiator&$top=200`
      );
      const filtered = rows
        .filter(r => validPersonIDs.has(r.PersonID))
        .map(r => ({ bill_id: r.BillID, person_id: r.PersonID, is_initiator: r.IsInitiator ?? true }));
      if (filtered.length > 0) {
        await supabaseAdmin.from('bill_initiators').upsert(filtered, { onConflict: 'bill_id,person_id' });
        count += filtered.length;
      }
    } catch { /* skip failed chunk */ }
  }
  return count;
}

// ── Sync: current K25 members ─────────────────────────────────────────────────

async function syncMembers(): Promise<number> {
  const members = await fetchRealMembers();

  const factionMap = new Map<number, { name: string; nameEng: string }>();
  for (const m of members) {
    if (m.FactionID && !factionMap.has(m.FactionID)) {
      factionMap.set(m.FactionID, {
        name: m.FactionName,
        nameEng: m.FactionNameEng || FACTION_ENG[m.FactionID] || m.FactionName,
      });
    }
  }

  const factionRows = Array.from(factionMap.entries()).map(([id, f]) => ({
    faction_id: id, name: f.name, name_eng: f.nameEng,
    knesset_num: CURRENT_KNESSET, is_current: true,
    is_coalition: COALITION_FACTION_IDS.has(id),
    updated_at: new Date().toISOString(),
  }));
  if (factionRows.length > 0) {
    const { error } = await supabaseAdmin.from('factions').upsert(factionRows, { onConflict: 'faction_id' });
    if (error) throw new Error(`Factions upsert: ${error.message}`);
  }

  const memberRows = members.map(m => ({
    person_id: m.PersonID, full_name: m.FullName, full_name_eng: m.FullNameEng,
    faction_id: m.FactionID ?? null, faction_name: m.FactionName,
    faction_name_eng: m.FactionNameEng, role_he: m.RoleHe, role_eng: m.RoleEng,
    email: m.Email ?? null, gender_id: m.GenderID, is_current: true,
    knesset_num: CURRENT_KNESSET, updated_at: new Date().toISOString(),
  }));
  const { error } = await supabaseAdmin.from('members').upsert(memberRows, { onConflict: 'person_id' });
  if (error) throw new Error(`Members upsert: ${error.message}`);

  return members.length;
}

// ── Sync: all historical MKs (K20–K25) ───────────────────────────────────────

async function syncAllMembers(): Promise<number> {
  // First sync current members
  const currentCount = await syncMembers();

  // Fetch past MKs (IsCurrent eq false) — multiple pages
  let totalPast = 0;
  for (let skip = 0; skip < 5000; skip += 100) {
    const page = await kFetch<{ PersonID: number; FirstName: string; LastName: string; GenderID: number; Email: string | null }>(
      `KNS_Person?$filter=IsCurrent eq false&$select=PersonID,FirstName,LastName,GenderID,Email&$top=100&$skip=${skip}`
    );
    if (page.length === 0) break;

    const rows = page.map(p => ({
      person_id: p.PersonID,
      full_name: `${p.FirstName} ${p.LastName}`,
      full_name_eng: '',
      faction_id: null, faction_name: '', faction_name_eng: '',
      role_he: 'חבר כנסת לשעבר', role_eng: 'Former MK',
      email: p.Email ?? null, gender_id: p.GenderID,
      is_current: false, knesset_num: 0,
      updated_at: new Date().toISOString(),
    }));

    // Only insert if not already in DB (don't overwrite current MK data)
    const existingIDs = new Set(
      (await supabaseAdmin.from('members').select('person_id').in('person_id', rows.map(r => r.person_id)))
        .data?.map(r => r.person_id) ?? []
    );
    const newRows = rows.filter(r => !existingIDs.has(r.person_id));
    if (newRows.length > 0) {
      await supabaseAdmin.from('members').insert(newRows);
      totalPast += newRows.length;
    }

    if (page.length < 100) break;
  }

  return currentCount + totalPast;
}

// ── Sync: ALL bills for a Knesset, resumable ──────────────────────────────────

async function syncBillsForKnesset(
  knessetNum: number,
  progressKey: string,
  deadline: number,  // ms timestamp — stop before this
): Promise<{ done: boolean; synced: number; skip: number }> {
  const progress = await getProgress(progressKey);
  if (progress?.is_done) return { done: true, synced: progress.total_synced, skip: progress.last_skip };

  let skip = progress?.last_skip ?? 0;
  let totalSynced = progress?.total_synced ?? 0;

  // Build a set of all known person_ids for initiator filtering
  const { data: memberData } = await supabaseAdmin.from('members').select('person_id');
  const validPersonIDs = new Set((memberData ?? []).map(m => m.person_id as number));

  while (Date.now() < deadline) {
    const page = await kFetch<{
      BillID: number; Name: string; StatusID: number | null;
      SubTypeID: number | null; PublicationDate: string | null; LastUpdatedDate: string | null;
    }>(
      `KNS_Bill?$filter=KnessetNum eq ${knessetNum}&$select=BillID,Name,StatusID,SubTypeID,PublicationDate,LastUpdatedDate&$top=100&$skip=${skip}`
    );

    if (page.length === 0) {
      await saveProgress(progressKey, skip, totalSynced, true);
      return { done: true, synced: totalSynced, skip };
    }

    await upsertBillsPage(page, knessetNum);

    // Fetch initiators for this page of bills
    const billIDs = page.map(b => b.BillID);
    await upsertInitiators(billIDs, validPersonIDs);

    totalSynced += page.length;
    skip += 100;
    await saveProgress(progressKey, skip, totalSynced, page.length < 100);

    if (page.length < 100) return { done: true, synced: totalSynced, skip };
  }

  // Ran out of time — save progress and return
  await saveProgress(progressKey, skip, totalSynced, false);
  return { done: false, synced: totalSynced, skip };
}

// ── Sync: passed bills for K25 (fast baseline, used by original sync) ─────────

async function syncPassedBills(): Promise<number> {
  const { data: memberData } = await supabaseAdmin.from('members').select('person_id');
  const validPersonIDs = new Set((memberData ?? []).map(m => m.person_id as number));

  const passedBillIDs: number[] = [];
  for (let skip = 0; skip < 800; skip += 100) {
    const page = await kFetch<{ BillID: number; Name: string; SubTypeID: number | null; PublicationDate: string | null }>(
      `KNS_Bill?$filter=KnessetNum eq ${CURRENT_KNESSET} and StatusID eq 118&$select=BillID,Name,SubTypeID,PublicationDate&$top=100&$skip=${skip}`
    );
    if (page.length === 0) break;
    await upsertBillsPage(page, CURRENT_KNESSET, 118);
    passedBillIDs.push(...page.map(b => b.BillID));
    if (page.length < 100) break;
  }

  await upsertInitiators(passedBillIDs, validPersonIDs);
  return passedBillIDs.length;
}

// ── Sync: daily incremental ───────────────────────────────────────────────────

async function syncDaily(): Promise<number> {
  // 1. Refresh current members (catches any MK changes)
  await syncMembers();

  // 2. Fetch K25 bills updated in the last 48h
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: memberData } = await supabaseAdmin.from('members').select('person_id');
  const validPersonIDs = new Set((memberData ?? []).map(m => m.person_id as number));

  let total = 0;
  for (let skip = 0; skip < 500; skip += 100) {
    const page = await kFetch<{
      BillID: number; Name: string; StatusID: number | null;
      SubTypeID: number | null; PublicationDate: string | null; LastUpdatedDate: string | null;
    }>(
      `KNS_Bill?$filter=KnessetNum eq ${CURRENT_KNESSET} and LastUpdatedDate gt datetime'${since.replace('Z', '')}'&$select=BillID,Name,StatusID,SubTypeID,PublicationDate,LastUpdatedDate&$top=100&$skip=${skip}`
    );
    if (page.length === 0) break;
    await upsertBillsPage(page, CURRENT_KNESSET);
    const billIDs = page.map(b => b.BillID);
    await upsertInitiators(billIDs, validPersonIDs);
    total += page.length;
    if (page.length < 100) break;
  }

  return total;
}

// ── Handler ───────────────────────────────────────────────────────────────────

const HISTORICAL_KNESSETS = [24, 23, 22, 21, 20];

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'members';

  const { data: logEntry } = await supabaseAdmin
    .from('sync_log')
    .insert({ sync_type: type })
    .select('id')
    .single();
  const logId = logEntry?.id as number | undefined;

  const started = Date.now();
  // Stop processing new pages 5s before the 60s limit
  const deadline = started + 55_000;

  try {
    let result: Record<string, unknown> = {};

    if (type === 'members') {
      const count = await syncMembers();
      result = { records: count };
    }

    else if (type === 'members-all') {
      const count = await syncAllMembers();
      result = { records: count };
    }

    else if (type === 'bills-k25') {
      const status = await syncBillsForKnesset(CURRENT_KNESSET, `bills_k${CURRENT_KNESSET}`, deadline);
      result = { ...status, knesset: CURRENT_KNESSET };
    }

    else if (type === 'bills-historical') {
      // Find the first Knesset that isn't done yet
      let worked = false;
      for (const k of HISTORICAL_KNESSETS) {
        const prog = await getProgress(`bills_k${k}`);
        if (prog?.is_done) continue;

        const status = await syncBillsForKnesset(k, `bills_k${k}`, deadline);
        result = { ...status, knesset: k };
        worked = true;

        // If this Knesset finished with time to spare, continue to the next one
        if (status.done && Date.now() < deadline - 5000) continue;
        break;
      }
      if (!worked) result = { done: true, message: 'All historical Knessets synced' };
    }

    else if (type === 'daily') {
      const count = await syncDaily();
      result = { records: count };
    }

    else if (type === 'full') {
      // Quick baseline: members + passed bills (original behavior)
      const memberCount = await syncMembers();
      const billCount = await syncPassedBills();
      result = { records: memberCount + billCount };
    }

    else {
      return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
    }

    if (logId) {
      await supabaseAdmin.from('sync_log').update({
        completed_at: new Date().toISOString(),
        records_synced: (result.records as number) ?? 0,
        status: 'success',
      }).eq('id', logId);
    }

    return NextResponse.json({ ok: true, type, durationMs: Date.now() - started, ...result });

  } catch (err) {
    const errMsg = String(err);
    console.error('Sync error:', errMsg);
    if (logId) {
      await supabaseAdmin.from('sync_log').update({
        completed_at: new Date().toISOString(),
        status: 'failed',
        error: errMsg,
      }).eq('id', logId);
    }
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [{ data: logs }, { count: members }, { count: bills }, { data: progress }] = await Promise.all([
    supabaseAdmin.from('sync_log').select('*').order('started_at', { ascending: false }).limit(10),
    supabaseAdmin.from('members').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('bills').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('sync_progress').select('*').order('updated_at', { ascending: false }),
  ]);

  return NextResponse.json({
    members_in_db: members ?? 0,
    bills_in_db: bills ?? 0,
    sync_progress: progress ?? [],
    recent_syncs: logs ?? [],
  });
}
