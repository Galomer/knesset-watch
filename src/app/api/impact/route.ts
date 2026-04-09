/**
 * GET /api/impact?type=parties          — impact breakdown per party
 * GET /api/impact?type=member&personID=X — impact breakdown for one MK
 *
 * Aggregates bill_classifications across all bills a party/member initiated in K25.
 * Returns per-group scores (pro - anti) and financial impact distribution.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { COALITION_FACTION_IDS, FACTION_ENG, FACTION_HE } from '@/lib/knesset-api';
import { GROUPS, type Group } from '@/lib/classifications';

export const revalidate = 3600;

export interface GroupStats {
  pro: number;
  anti: number;
  neutral: number;
  score: number;      // pro - anti
  scorePct: number;   // (pro - anti) / (pro + anti) * 100, or 0 if none
}

export interface FinancialStats {
  positive: number;
  negative: number;
  neutral: number;
  unknown: number;
}

export interface ImpactData {
  id: number;            // FactionID or PersonID
  name: string;
  nameEng: string;
  isCoalition?: boolean;
  totalBills: number;
  classifiedBills: number;
  groups: Record<Group, GroupStats>;
  financial: FinancialStats;
}

function emptyGroups(): Record<Group, GroupStats> {
  return Object.fromEntries(
    GROUPS.map(g => [g, { pro: 0, anti: 0, neutral: 0, score: 0, scorePct: 0 }])
  ) as Record<Group, GroupStats>;
}

// scorePct: direction score (pro-anti)/(pro+anti)*100 — used for color only.
// When pro+anti is small, this gives ±100% which is directionally correct.
// Raw counts (pro, anti) are shown as the main cell content.
function finalise(groups: Record<Group, GroupStats>, _totalClassified: number): Record<Group, GroupStats> {
  for (const g of GROUPS) {
    const { pro, anti } = groups[g];
    groups[g].score = pro - anti;
    const stance = pro + anti;
    groups[g].scorePct = stance > 0 ? Math.round(((pro - anti) / stance) * 100) : 0;
  }
  return groups;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function accumulate(groups: Record<Group, GroupStats>, financial: FinancialStats, c: any) {
  for (const g of GROUPS) {
    const stance: string = c[g] ?? 'neutral';
    if (stance === 'pro')       groups[g].pro++;
    else if (stance === 'anti') groups[g].anti++;
    else                        groups[g].neutral++;
  }
  const fi: string = c.financial_impact ?? 'unknown';
  if (fi === 'positive')       financial.positive++;
  else if (fi === 'negative')  financial.negative++;
  else if (fi === 'neutral')   financial.neutral++;
  else                         financial.unknown++;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') ?? 'parties';
  const personID = Number(searchParams.get('personID') ?? '0');

  try {
    // ── 1. Fetch all current members → person→faction map ─────────────────
    const { data: members } = await supabaseAdmin
      .from('members')
      .select('person_id, faction_id, full_name, full_name_eng')
      .eq('is_current', true);

    const personToFaction = new Map<number, number>();
    const memberNames = new Map<number, { name: string; nameEng: string }>();
    for (const m of members ?? []) {
      if (m.faction_id) personToFaction.set(m.person_id, m.faction_id);
      memberNames.set(m.person_id, { name: m.full_name, nameEng: m.full_name_eng });
    }

    // ── 2. Fetch classifications + initiators separately, join in JS ─────────
    // (bill_classifications and bill_initiators both FK to bills — no direct FK between them)
    const groupCols = GROUPS.join(', ');

    async function fetchAllPages<T>(table: string, select: string): Promise<T[]> {
      const PAGE = 1000;
      const rows: T[] = [];
      let offset = 0;
      while (true) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: page, error } = await (supabaseAdmin as any)
          .from(table).select(select).range(offset, offset + PAGE - 1);
        if (error || !page || page.length === 0) break;
        rows.push(...page);
        if (page.length < PAGE) break;
        offset += PAGE;
      }
      return rows;
    }

    const [rawClass, rawInit] = await Promise.all([
      fetchAllPages<Record<string, unknown>>('bill_classifications', `bill_id, financial_impact, ${groupCols}`),
      fetchAllPages<{ bill_id: number; person_id: number }>('bill_initiators', 'bill_id, person_id'),
    ]);

    // Build bill_id → person_ids map
    const billToPersons = new Map<number, number[]>();
    for (const r of rawInit) {
      const arr = billToPersons.get(r.bill_id) ?? [];
      arr.push(r.person_id);
      billToPersons.set(r.bill_id, arr);
    }

    // Attach initiators to classification rows
    const classRows = rawClass.map(c => ({
      ...c,
      bill_initiators: (billToPersons.get(c.bill_id as number) ?? []).map(pid => ({ person_id: pid })),
    }));

    if (!classRows || classRows.length === 0) {
      if (type === 'member') {
        return NextResponse.json({ id: personID, classifiedBills: 0, totalBills: 0, groups: emptyGroups(), financial: { positive: 0, negative: 0, neutral: 0, unknown: 0 } });
      }
      return NextResponse.json([]);
    }

    // ── 3. Aggregate ───────────────────────────────────────────────────────
    if (type === 'member') {
      const groups   = emptyGroups();
      const financial: FinancialStats = { positive: 0, negative: 0, neutral: 0, unknown: 0 };
      let classified = 0;

      for (const row of classRows) {
        const initiators = ((row as any).bill_initiators as { person_id: number }[] | null) ?? [];
        if (!initiators.some(i => i.person_id === personID)) continue;
        accumulate(groups, financial, row);
        classified++;
      }

      // Total bills for this member from DB
      const { count: totalBills } = await supabaseAdmin
        .from('bill_initiators')
        .select('*', { count: 'exact', head: true })
        .eq('person_id', personID);

      const memberInfo = memberNames.get(personID) ?? { name: '', nameEng: '' };
      const result: ImpactData = {
        id: personID,
        name: memberInfo.name,
        nameEng: memberInfo.nameEng,
        totalBills: totalBills ?? 0,
        classifiedBills: classified,
        groups: finalise(groups, classified),
        financial,
      };
      return NextResponse.json(result);
    }

    // type === 'parties'
    const factionGroups   = new Map<number, Record<Group, GroupStats>>();
    const factionFinancial = new Map<number, FinancialStats>();
    const factionBillCount = new Map<number, number>();
    const factionClassified = new Map<number, number>();

    for (const row of classRows) {
      const initiators = ((row as any).bill_initiators as { person_id: number }[] | null) ?? [];
      const factionIDs = new Set<number>();

      for (const { person_id } of initiators) {
        const fid = personToFaction.get(person_id);
        if (fid) factionIDs.add(fid);
      }

      for (const fid of factionIDs) {
        if (!factionGroups.has(fid)) {
          factionGroups.set(fid, emptyGroups());
          factionFinancial.set(fid, { positive: 0, negative: 0, neutral: 0, unknown: 0 });
        }
        accumulate(factionGroups.get(fid)!, factionFinancial.get(fid)!, row);
        factionClassified.set(fid, (factionClassified.get(fid) ?? 0) + 1);
      }
    }

    // Count total bills per faction from all initiators (rawInit already has everything)
    for (const { person_id } of rawInit) {
      const fid = personToFaction.get(person_id);
      if (fid) factionBillCount.set(fid, (factionBillCount.get(fid) ?? 0) + 1);
    }

    // Fetch faction names
    const { data: factions } = await supabaseAdmin
      .from('factions')
      .select('faction_id, name, name_eng')
      .eq('is_current', true);

    const factionNames = new Map((factions ?? []).map(f => [f.faction_id, { name: f.name, nameEng: f.name_eng }]));

    const result: ImpactData[] = Array.from(factionGroups.entries())
      .map(([fid, groups]) => {
        const classified = factionClassified.get(fid) ?? 0;
        return {
          id: fid,
          name: FACTION_HE[fid] ?? factionNames.get(fid)?.name ?? String(fid),
          nameEng: FACTION_ENG[fid] ?? factionNames.get(fid)?.nameEng ?? String(fid),
          isCoalition: COALITION_FACTION_IDS.has(fid),
          totalBills: factionBillCount.get(fid) ?? 0,
          classifiedBills: classified,
          groups: finalise(groups, classified),
          financial: factionFinancial.get(fid)!,
        };
      })
      .filter(p => p.classifiedBills > 0)
      .sort((a, b) => b.totalBills - a.totalBills);

    return NextResponse.json(result);

  } catch (err) {
    console.error('Impact API error:', err);
    return NextResponse.json([], { status: 500 });
  }
}
