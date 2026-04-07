import { NextResponse } from 'next/server';
import { fetchRealMembers, getMockMembers, RealMember, FACTION_HE, FACTION_ENG } from '@/lib/knesset-api';
import { supabaseAdmin, DbMember } from '@/lib/supabase';

export const revalidate = 3600;

function dbToRealMember(m: DbMember): RealMember {
  return {
    PersonID: m.person_id,
    FirstName: m.full_name.split(' ')[0] ?? '',
    LastName: m.full_name.split(' ').slice(1).join(' ') ?? '',
    FullName: m.full_name,
    FullNameEng: m.full_name_eng,
    GenderID: m.gender_id ?? 251,
    Email: m.email,
    FactionID: m.faction_id,
    FactionName: m.faction_id ? (FACTION_HE[m.faction_id] ?? m.faction_name) : m.faction_name,
    FactionNameEng: m.faction_id ? (FACTION_ENG[m.faction_id] ?? m.faction_name_eng) : m.faction_name_eng,
    RoleHe: m.role_he,
    RoleEng: m.role_eng,
    GovMinistryName: null,
    BillsProposed: 0,
    BillsPassed: 0,
    AttendancePct: null,
  };
}

export async function GET() {
  // 1. Try database first (instant if synced)
  try {
    const { data, error } = await supabaseAdmin
      .from('members')
      .select('*')
      .eq('is_current', true)
      .order('full_name');

    if (!error && data && data.length > 0) {
      return NextResponse.json((data as DbMember[]).map(dbToRealMember));
    }
  } catch (dbErr) {
    console.warn('DB unavailable, falling back to live API:', dbErr);
  }

  // 2. Fall back to live Knesset API
  try {
    const members = await fetchRealMembers();
    if (members.length > 0) return NextResponse.json(members);
  } catch (err) {
    console.error('Live API also failed:', err);
  }

  return NextResponse.json(getMockMembers());
}
