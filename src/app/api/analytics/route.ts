/**
 * Analytics endpoint — party-level statistics
 *
 * Reads from Supabase DB when available (instant).
 * Falls back to live Knesset API computation when DB is empty (first run).
 *
 * DB is populated by POST /api/sync?type=bills (runs daily via cron).
 */

import { NextResponse } from 'next/server';
import { CURRENT_KNESSET, FACTION_ENG, COALITION_FACTION_IDS } from '@/lib/knesset-api';
import { supabaseAdmin } from '@/lib/supabase';

export const revalidate = 3600;

const BASE = 'https://knesset.gov.il/Odata/ParliamentInfo.svc';

async function kFetch<T>(path: string): Promise<T[]> {
  const url = `${BASE}/${path}${path.includes('?') ? '&' : '?'}$format=json`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  const data = await res.json();
  return (data?.value ?? []) as T[];
}

export interface PartyStats {
  FactionID: number;
  Name: string;
  NameEng: string;
  Seats: number;
  IsCoalition: boolean;
  Members: number[];
  BillsProposed: number;
  BillsPassed: number;
  BillsPassedUnique: number;
}

// ── Read from DB (fast path) ──────────────────────────────────────────────────

async function analyticsFromDB(): Promise<PartyStats[] | null> {
  const [
    { data: factions, error: fErr },
    { data: members, error: mErr },
    { data: passedInitiators, error: piErr },
    { data: proposedInitiators, error: prErr },
  ] = await Promise.all([
    supabaseAdmin.from('factions').select('faction_id, name, name_eng, is_coalition').eq('is_current', true),
    supabaseAdmin.from('members').select('person_id, faction_id').eq('is_current', true),
    // Passed bills (K25, status 118)
    supabaseAdmin
      .from('bill_initiators')
      .select('person_id, bill_id, bills!inner(status_id)')
      .eq('bills.status_id', 118),
    // All proposed bills (K25)
    supabaseAdmin
      .from('bill_initiators')
      .select('person_id, bill_id, bills!inner(knesset_num)')
      .eq('bills.knesset_num', CURRENT_KNESSET),
  ]);

  if (fErr || mErr || !factions || !members || factions.length === 0 || members.length === 0) {
    return null;
  }

  // Build maps
  const personToFaction = new Map<number, number>();
  const membersByFaction = new Map<number, number[]>();
  for (const m of members) {
    if (!m.faction_id) continue;
    personToFaction.set(m.person_id, m.faction_id);
    const arr = membersByFaction.get(m.faction_id) ?? [];
    arr.push(m.person_id);
    membersByFaction.set(m.faction_id, arr);
  }

  // Count passed bills per faction
  const passedByFaction = new Map<number, Set<number>>();
  if (!piErr && passedInitiators) {
    for (const row of passedInitiators) {
      const fid = personToFaction.get(row.person_id);
      if (!fid) continue;
      const s = passedByFaction.get(fid) ?? new Set<number>();
      s.add(row.bill_id);
      passedByFaction.set(fid, s);
    }
  }

  // Count proposed bills per faction (all K25 bills)
  const proposedByFaction = new Map<number, Set<number>>();
  if (!prErr && proposedInitiators) {
    for (const row of proposedInitiators) {
      const fid = personToFaction.get(row.person_id);
      if (!fid) continue;
      const s = proposedByFaction.get(fid) ?? new Set<number>();
      s.add(row.bill_id);
      proposedByFaction.set(fid, s);
    }
  }

  return factions
    .map(f => ({
      FactionID: f.faction_id,
      Name: f.name,
      NameEng: f.name_eng || FACTION_ENG[f.faction_id] || f.name,
      Seats: membersByFaction.get(f.faction_id)?.length ?? 0,
      IsCoalition: f.is_coalition ?? COALITION_FACTION_IDS.has(f.faction_id),
      Members: membersByFaction.get(f.faction_id) ?? [],
      BillsProposed: proposedByFaction.get(f.faction_id)?.size ?? 0,
      BillsPassed: passedByFaction.get(f.faction_id)?.size ?? 0,
      BillsPassedUnique: passedByFaction.get(f.faction_id)?.size ?? 0,
    }))
    .filter(f => f.Seats > 0)
    .sort((a, b) => b.Seats - a.Seats);
}

// ── Compute from live API (slow fallback) ─────────────────────────────────────

async function analyticsFromAPI(): Promise<PartyStats[]> {
  const factions = await kFetch<{ FactionID: number; Name: string; IsCurrent: boolean }>(
    `KNS_Faction?$filter=KnessetNum eq ${CURRENT_KNESSET}&$select=FactionID,Name,IsCurrent&$top=50`
  );

  const [fp1, fp2] = await Promise.all([
    kFetch<{ PersonID: number; FactionID: number | null }>(
      `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and PositionID eq 54&$select=PersonID,FactionID&$top=100`
    ),
    kFetch<{ PersonID: number; FactionID: number | null }>(
      `KNS_PersonToPosition?$filter=KnessetNum eq ${CURRENT_KNESSET} and IsCurrent eq true and PositionID eq 54&$select=PersonID,FactionID&$top=100&$skip=100`
    ),
  ]);
  const allFactionPos = [...fp1, ...fp2].filter(x => x.FactionID);
  const personToFaction = new Map<number, number>(allFactionPos.map(x => [x.PersonID, x.FactionID!]));
  const membersByFaction = new Map<number, number[]>();
  for (const { PersonID, FactionID } of allFactionPos) {
    if (!FactionID) continue;
    const arr = membersByFaction.get(FactionID) ?? [];
    arr.push(PersonID);
    membersByFaction.set(FactionID, arr);
  }

  const passedBillIDs: number[] = [];
  for (let skip = 0; skip < 700; skip += 100) {
    const page = await kFetch<{ BillID: number }>(
      `KNS_Bill?$filter=KnessetNum eq ${CURRENT_KNESSET} and StatusID eq 118&$select=BillID&$top=100&$skip=${skip}`
    );
    passedBillIDs.push(...page.map(b => b.BillID));
    if (page.length < 100) break;
  }

  const passedByFaction = new Map<number, Set<number>>();
  for (let i = 0; i < passedBillIDs.length; i += 25) {
    const chunk = passedBillIDs.slice(i, i + 25);
    const idFilter = chunk.map(id => `BillID eq ${id}`).join(' or ');
    try {
      const initiators = await kFetch<{ BillID: number; PersonID: number }>(
        `KNS_BillInitiator?$filter=${idFilter}&$select=BillID,PersonID&$top=200`
      );
      for (const { BillID, PersonID } of initiators) {
        const fid = personToFaction.get(PersonID);
        if (!fid) continue;
        const s = passedByFaction.get(fid) ?? new Set<number>();
        s.add(BillID);
        passedByFaction.set(fid, s);
      }
    } catch { /* skip failed chunk */ }
  }

  return factions
    .filter(f => f.IsCurrent)
    .map(f => ({
      FactionID: f.FactionID,
      Name: f.Name.trim(),
      NameEng: FACTION_ENG[f.FactionID] ?? f.Name.trim(),
      Seats: membersByFaction.get(f.FactionID)?.length ?? 0,
      IsCoalition: COALITION_FACTION_IDS.has(f.FactionID),
      Members: membersByFaction.get(f.FactionID) ?? [],
      BillsProposed: 0,
      BillsPassed: passedByFaction.get(f.FactionID)?.size ?? 0,
      BillsPassedUnique: passedByFaction.get(f.FactionID)?.size ?? 0,
    }))
    .filter(f => f.Seats > 0)
    .sort((a, b) => b.Seats - a.Seats);
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    // Try DB first
    const dbResult = await analyticsFromDB();
    if (dbResult) return NextResponse.json(dbResult);
  } catch (dbErr) {
    console.warn('DB unavailable, falling back to live API:', dbErr);
  }

  // Fall back to live API
  try {
    const result = await analyticsFromAPI();
    return NextResponse.json(result);
  } catch (err) {
    console.error('Analytics error:', err);
    return NextResponse.json([], { status: 500 });
  }
}
