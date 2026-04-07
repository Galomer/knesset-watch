/**
 * GET /api/bills
 * Query params:
 *   knesset  — knesset number (default: 25)
 *   status   — 'passed' | 'stopped' | 'pending' | '' (all)
 *   type     — 'government' | 'private' | '' (all)
 *   group    — group key (e.g. 'women') — filter bills classified as pro/anti for this group
 *   stance   — 'pro' | 'anti' (used with group filter, default: 'pro')
 *   search   — text search in bill name
 *   page     — page index (default: 0)
 *   limit    — page size (default: 50, max: 100)
 *   counts   — '1' → return { passed, stopped, pending } counts only (no bills)
 *
 * Returns: { bills: [...], total: number, page: number, pageSize: number }
 *      or: { passed: number, stopped: number, pending: number }  (when counts=1)
 */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchRealBills, billStatusLabel, billStatusCategory } from '@/lib/knesset-api';
import { GROUPS, type Group } from '@/lib/classifications';

export const revalidate = 3600;

const stoppedIDs = [110, 122, 124, 176, 177];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const knesset  = Number(searchParams.get('knesset') ?? '25');
  const status   = searchParams.get('status') ?? '';
  const type     = searchParams.get('type') ?? '';
  const group    = searchParams.get('group') ?? '';
  const stance   = searchParams.get('stance') ?? 'pro';
  const search   = searchParams.get('search') ?? '';
  const page     = Math.max(0, Number(searchParams.get('page') ?? '0'));
  const limit    = Math.min(100, Math.max(10, Number(searchParams.get('limit') ?? '50')));
  const countsOnly = searchParams.get('counts') === '1';

  const isValidGroup = GROUPS.includes(group as Group);

  // ── Counts mode ────────────────────────────────────────────────────────────
  if (countsOnly) {
    try {
      const [passedRes, stoppedRes, activeRes] = await Promise.all([
        supabaseAdmin.from('bills').select('*', { count: 'exact', head: true }).eq('knesset_num', knesset).eq('status_id', 118),
        supabaseAdmin.from('bills').select('*', { count: 'exact', head: true }).eq('knesset_num', knesset).in('status_id', stoppedIDs),
        supabaseAdmin.from('bills').select('*', { count: 'exact', head: true }).eq('knesset_num', knesset).not('status_id', 'in', `(${[118, ...stoppedIDs].join(',')})`),
      ]);
      return NextResponse.json({
        passed:  passedRes.count ?? 0,
        stopped: stoppedRes.count ?? 0,
        pending: activeRes.count ?? 0,
      });
    } catch {
      return NextResponse.json({ passed: 0, stopped: 0, pending: 0 });
    }
  }

  // ── DB path ────────────────────────────────────────────────────────────────
  try {
    // Step 1: if group filter is active, get matching bill_ids from bill_classifications
    let groupFilterIDs: number[] | null = null;
    if (isValidGroup && (stance === 'pro' || stance === 'anti')) {
      try {
        const { data: gcData } = await supabaseAdmin
          .from('bill_classifications')
          .select('bill_id')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .eq(group as any, stance);
        groupFilterIDs = (gcData ?? []).map((r: { bill_id: number }) => r.bill_id);
        if (groupFilterIDs.length === 0) {
          return NextResponse.json({ bills: [], total: 0, page, pageSize: limit });
        }
      } catch {
        groupFilterIDs = null; // ignore group filter if table not available
      }
    }

    // Step 2: query bills table (no classification join — avoids missing-column errors)
    let query = supabaseAdmin
      .from('bills')
      .select('bill_id, name, knesset_num, status_id, is_government, publication_date', { count: 'exact' })
      .eq('knesset_num', knesset)
      .order('publication_date', { ascending: false, nullsFirst: false })
      .order('bill_id', { ascending: false })
      .range(page * limit, page * limit + limit - 1);

    if (status === 'passed')       query = query.eq('status_id', 118);
    else if (status === 'stopped') query = query.in('status_id', stoppedIDs);
    else if (status === 'pending') query = query.not('status_id', 'in', `(${[118, ...stoppedIDs].join(',')})`);

    if (type === 'government') query = query.eq('is_government', true);
    if (type === 'private')    query = query.eq('is_government', false);
    if (search)                query = query.ilike('name', `%${search}%`);

    if (groupFilterIDs !== null) {
      query = query.in('bill_id', groupFilterIDs);
    }

    const { data, error, count } = await query;

    if (error) throw error;
    if (!data) throw new Error('No data returned');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const billIDs = (data as any[]).map((b: { bill_id: number }) => b.bill_id);

    // Step 3: fetch bill_classifications separately (graceful failure)
    const classMap = new Map<number, Record<string, unknown>>();
    if (billIDs.length > 0) {
      try {
        const classCols = `bill_id, ${GROUPS.join(', ')}, financial_impact, financial_note, benefits, hurts, confidence, summary`;
        const { data: classData } = await supabaseAdmin
          .from('bill_classifications')
          .select(classCols)
          .in('bill_id', billIDs);
        for (const row of (classData ?? [])) {
          classMap.set((row as { bill_id: number }).bill_id, row as Record<string, unknown>);
        }
      } catch {
        // classifications table missing or columns missing — just skip
      }
    }

    // Step 4: fetch initiators + member names
    const initiatorMap = new Map<number, { name: string; nameEng: string; faction: string }[]>();
    if (billIDs.length > 0) {
      try {
        const { data: initRows } = await supabaseAdmin
          .from('bill_initiators')
          .select('bill_id, person_id, is_initiator')
          .in('bill_id', billIDs);

        if (initRows && initRows.length > 0) {
          const personIDs = [...new Set(initRows.map(r => r.person_id))];

          const { data: memberRows } = await supabaseAdmin
            .from('members')
            .select('person_id, full_name, full_name_eng, faction_name')
            .in('person_id', personIDs);

          const memberMap = new Map(
            (memberRows ?? []).map(m => [
              m.person_id,
              { name: m.full_name, nameEng: m.full_name_eng ?? m.full_name, faction: m.faction_name ?? '' },
            ])
          );

          for (const r of initRows) {
            const member = memberMap.get(r.person_id);
            if (!member) continue;
            const existing = initiatorMap.get(r.bill_id) ?? [];
            if (r.is_initiator) existing.unshift(member);
            else existing.push(member);
            initiatorMap.set(r.bill_id, existing);
          }
        }
      } catch {
        // initiators unavailable — bills still show without them
      }
    }

    // Step 5: assemble response
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bills = (data as any[]).map((b) => {
      const classification = classMap.get(b.bill_id) ?? null;
      return {
        BillID: b.bill_id,
        Name: (b.name as string) ?? '',
        KnessetNum: b.knesset_num,
        StatusID: b.status_id,
        StatusDesc: billStatusLabel(b.status_id, 'he'),
        StatusDescEn: billStatusLabel(b.status_id, 'en'),
        StatusCategory: billStatusCategory(b.status_id),
        SubTypeDesc: b.is_government ? 'ממשלתית' : 'פרטית',
        IsGovernment: b.is_government,
        PublicationDate: b.publication_date,
        Classification: classification,
        Initiators: initiatorMap.get(b.bill_id) ?? [],
      };
    });

    return NextResponse.json({ bills, total: count ?? 0, page, pageSize: limit });

  } catch (dbErr) {
    console.warn('DB unavailable for bills, falling back:', dbErr);
  }

  // ── API fallback (legacy) ──────────────────────────────────────────────────
  try {
    const bills = await fetchRealBills(limit);
    return NextResponse.json({ bills: bills.map(b => ({ ...b, Initiators: [] })), total: bills.length, page: 0, pageSize: limit });
  } catch (err) {
    console.error('Failed to fetch bills:', err);
    return NextResponse.json({ bills: [], total: 0, page: 0, pageSize: limit }, { status: 500 });
  }
}
