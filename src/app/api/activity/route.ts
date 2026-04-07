/**
 * GET /api/activity
 * Returns quarterly bill activity time-series.
 *
 * Query params:
 *   knesset  — filter to a specific Knesset number, or 'all' (default: all)
 *   faction  — faction_id to filter by (optional)
 *   side     — 'coalition' | 'opposition' (optional, overrides faction)
 *
 * Returns: { quarters: QuarterPoint[], factions: FactionOption[] }
 *
 * QuarterPoint: { quarter: "2023 Q2", label: "Q2 2023", filed: N, passed: N }
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { COALITION_FACTION_IDS } from '@/lib/knesset-api';

export const revalidate = 3600;

export interface QuarterPoint {
  quarter: string;   // sortable key: "2015 Q2"
  label: string;     // display: "Q2 2015"
  filed: number;
  passed: number;
}

function toQuarter(dateStr: string): { quarter: string; label: string } {
  const y = parseInt(dateStr.slice(0, 4));
  const m = parseInt(dateStr.slice(5, 7));
  const q = Math.ceil(m / 3);
  return { quarter: `${y} Q${q}`, label: `Q${q} ${y}` };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const knesset  = searchParams.get('knesset') ?? 'all';
  const factionId = searchParams.get('faction') ? Number(searchParams.get('faction')) : null;
  const side      = searchParams.get('side') ?? '';

  try {
    // ── Step 1: Determine which bill_ids to include (faction/side filter) ──────
    let allowedBillIDs: Set<number> | null = null;

    if (factionId || side === 'coalition' || side === 'opposition') {
      // Get person_ids for the faction(s)
      let memberQuery = supabaseAdmin.from('members').select('person_id, faction_id').eq('is_current', false);
      // Include all members (current + former), filter by faction
      const { data: allMembers } = await supabaseAdmin.from('members').select('person_id, faction_id');

      let personIDs: number[] = [];
      if (factionId) {
        personIDs = (allMembers ?? []).filter(m => m.faction_id === factionId).map(m => m.person_id);
      } else if (side === 'coalition') {
        personIDs = (allMembers ?? []).filter(m => m.faction_id && COALITION_FACTION_IDS.has(m.faction_id)).map(m => m.person_id);
      } else {
        personIDs = (allMembers ?? []).filter(m => m.faction_id && !COALITION_FACTION_IDS.has(m.faction_id)).map(m => m.person_id);
      }

      if (personIDs.length === 0) {
        return NextResponse.json({ quarters: [], factions: [] });
      }

      // Fetch bill_ids initiated by these members (in batches)
      const billIDSet = new Set<number>();
      for (let i = 0; i < personIDs.length; i += 200) {
        const chunk = personIDs.slice(i, i + 200);
        const { data: initRows } = await supabaseAdmin
          .from('bill_initiators')
          .select('bill_id')
          .in('person_id', chunk);
        (initRows ?? []).forEach(r => billIDSet.add(r.bill_id));
      }
      allowedBillIDs = billIDSet;
    }

    // ── Step 2: Fetch bills with dates ────────────────────────────────────────
    // We need all bills (not just those with publication_date) to show activity.
    // - "filed" bar  → last_updated_date (reflects when the bill was last active in Knesset)
    // - "passed" line → publication_date  (official gazette date, only set for enacted laws)
    let query = supabaseAdmin
      .from('bills')
      .select('bill_id, publication_date, last_updated_date, status_id, knesset_num');

    if (knesset !== 'all') {
      query = query.eq('knesset_num', Number(knesset));
    }

    const { data: bills } = await query;

    // ── Step 3: Aggregate into quarters ──────────────────────────────────────
    const map = new Map<string, { label: string; filed: number; passed: number }>();

    for (const b of bills ?? []) {
      if (allowedBillIDs && !allowedBillIDs.has(b.bill_id)) continue;

      // "filed" bucket: use last_updated_date (available for all bills)
      const activityDate = b.last_updated_date
        ? b.last_updated_date.slice(0, 10)   // trim to YYYY-MM-DD
        : null;
      if (activityDate) {
        const { quarter, label } = toQuarter(activityDate);
        const existing = map.get(quarter) ?? { label, filed: 0, passed: 0 };
        existing.filed++;
        map.set(quarter, existing);
      }

      // "passed" bucket: use publication_date (only set when bill became law)
      if (b.status_id === 118 && b.publication_date) {
        const { quarter, label } = toQuarter(b.publication_date);
        const existing = map.get(quarter) ?? { label, filed: 0, passed: 0 };
        existing.passed++;
        map.set(quarter, existing);
      }
    }

    const quarters: QuarterPoint[] = Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([quarter, v]) => ({ quarter, ...v }));

    // ── Step 4: Factions list (for the filter dropdown) ──────────────────────
    const { data: factions } = await supabaseAdmin
      .from('factions')
      .select('faction_id, name, name_eng, is_coalition')
      .eq('is_current', true)
      .order('name');

    const factionOptions = (factions ?? []).map(f => ({
      id: f.faction_id,
      name: f.name,
      nameEng: f.name_eng,
      isCoalition: f.is_coalition,
    }));

    return NextResponse.json({ quarters, factions: factionOptions });

  } catch (err) {
    console.error('Activity API error:', err);
    return NextResponse.json({ quarters: [], factions: [] }, { status: 500 });
  }
}
