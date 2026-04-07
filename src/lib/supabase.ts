import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Server-side admin client — only used in API routes, never imported by client components.
// Uses the service role key so it can read/write without Row Level Security restrictions.
export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

// ── DB row types ──────────────────────────────────────────────────────────────

export interface DbMember {
  person_id: number;
  full_name: string;
  full_name_eng: string;
  faction_id: number | null;
  faction_name: string;
  faction_name_eng: string;
  role_he: string;
  role_eng: string;
  email: string | null;
  gender_id: number | null;
  is_current: boolean;
  updated_at: string;
}

export interface DbFaction {
  faction_id: number;
  name: string;
  name_eng: string;
  knesset_num: number;
  is_current: boolean;
  is_coalition: boolean;
  updated_at: string;
}

export interface DbBill {
  bill_id: number;
  name: string | null;
  knesset_num: number;
  status_id: number | null;
  is_government: boolean;
  publication_date: string | null;
  updated_at: string;
}

export interface DbBillInitiator {
  bill_id: number;
  person_id: number;
  is_initiator: boolean;
}
