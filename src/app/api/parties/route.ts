import { NextResponse } from 'next/server';
import { fetchRealParties, COALITION_FACTION_IDS, FACTION_ENG } from '@/lib/knesset-api';
import { supabaseAdmin } from '@/lib/supabase';

export const revalidate = 3600;

export async function GET() {
  // 1. Try database first
  try {
    const [{ data: factions, error: fErr }, { data: members, error: mErr }] = await Promise.all([
      supabaseAdmin.from('factions').select('faction_id, name, name_eng, is_coalition').eq('is_current', true),
      supabaseAdmin.from('members').select('person_id, faction_id').eq('is_current', true),
    ]);

    if (!fErr && !mErr && factions && factions.length > 0 && members && members.length > 0) {
      const membersByFaction = new Map<number, number[]>();
      for (const m of members) {
        if (!m.faction_id) continue;
        const arr = membersByFaction.get(m.faction_id) ?? [];
        arr.push(m.person_id);
        membersByFaction.set(m.faction_id, arr);
      }

      const parties = factions
        .map(f => ({
          FactionID: f.faction_id,
          Name: f.name,
          NameEng: f.name_eng || FACTION_ENG[f.faction_id] || f.name,
          Seats: membersByFaction.get(f.faction_id)?.length ?? 0,
          IsCoalition: f.is_coalition ?? COALITION_FACTION_IDS.has(f.faction_id),
          Members: membersByFaction.get(f.faction_id) ?? [],
        }))
        .filter(p => p.Seats > 0)
        .sort((a, b) => b.Seats - a.Seats);

      return NextResponse.json(parties);
    }
  } catch (dbErr) {
    console.warn('DB unavailable, falling back to live API:', dbErr);
  }

  // 2. Fall back to live API
  try {
    const parties = await fetchRealParties();
    return NextResponse.json(parties);
  } catch (err) {
    console.error('Failed to fetch parties:', err);
    return NextResponse.json([], { status: 500 });
  }
}
