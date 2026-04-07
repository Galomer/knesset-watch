/**
 * GET /api/member-profile?personID=X
 *
 * Returns a political profile for an MK.
 * - Cached in member_political_profiles (TTL: 7 days)
 * - On miss: compiles bills + votes + news → Claude Sonnet → stores in DB
 *
 * Returns: MemberPoliticalProfile
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export interface MemberPoliticalProfile {
  personID: number;
  leftRightScore: number;       // 0 = far left, 100 = far right
  extremismScore: number;       // 0 = moderate, 100 = extreme
  stanceWomen: number;          // -2 to 2
  stanceLgbt: number;
  stanceMilitary: number;
  stanceDemocracy: number;
  propagandaScore: number;      // 0–100
  hypocrisyScore: number;       // 0–100
  politicalSummary: string;
  stanceNotes: Record<string, string>;
  propagandaNote: string;
  hypocrisyNote: string;
  generatedAt: string;
  fromCache: boolean;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CACHE_TTL_DAYS = 7;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personID = Number(searchParams.get('personID'));
  if (!personID) return NextResponse.json({ error: 'personID required' }, { status: 400 });

  // ── 1. Check cache ────────────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - CACHE_TTL_DAYS * 86400_000).toISOString();
  const { data: cached } = await supabaseAdmin
    .from('member_political_profiles')
    .select('*')
    .eq('person_id', personID)
    .gte('generated_at', cutoff)
    .single();

  if (cached) {
    return NextResponse.json(toProfile(cached, true));
  }

  // ── 2. Gather data about the member ──────────────────────────────────────
  const [memberRes, billsRes, votesRes, newsRes] = await Promise.allSettled([
    supabaseAdmin
      .from('members')
      .select('full_name, faction_name, role_he')
      .eq('person_id', personID)
      .single(),

    supabaseAdmin
      .from('bill_initiators')
      .select('bills!inner(name, status_id, is_government, knesset_num)')
      .eq('person_id', personID)
      .limit(40),

    supabaseAdmin
      .from('vote_headers')
      .select('sess_item_dscr, vote_item_dscr, mk_result')
      .eq('person_id', personID)
      .order('vote_id', { ascending: false })
      .limit(30),

    supabaseAdmin
      .from('member_news')
      .select('title, ai_summary')
      .eq('person_id', personID)
      .order('published_at', { ascending: false, nullsFirst: false })
      .limit(10),
  ]);

  const member = memberRes.status === 'fulfilled' ? memberRes.value.data : null;
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bills = billsRes.status === 'fulfilled' ? (billsRes.value.data ?? []) as any[] : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const votes = votesRes.status === 'fulfilled' ? (votesRes.value.data ?? []) as any[] : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const news  = newsRes.status  === 'fulfilled' ? (newsRes.value.data  ?? []) as any[] : [];

  // ── 3. Build prompt context ───────────────────────────────────────────────
  const billLines = bills
    .map(r => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b = (r.bills as any);
      const status = b.status_id === 118 ? '✓ עבר' : b.status_id === 177 ? '✗ נעצר' : '⏳ בדיון';
      return `• ${b.name ?? '?'} [${status}]`;
    })
    .join('\n');

  const voteLines = votes
    .map(v => {
      const stance = v.mk_result === 1 ? 'בעד' : v.mk_result === 2 ? 'נגד' : 'נמנע/נעדר';
      return `• ${v.sess_item_dscr ?? v.vote_item_dscr ?? '?'} — ${stance}`;
    })
    .join('\n');

  const newsLines = news
    .map(n => `• ${n.title}${n.ai_summary ? ': ' + n.ai_summary : ''}`)
    .join('\n');

  const prompt = `אתה מנתח פוליטי אובייקטיבי. נתח את חבר/ת הכנסת הבאים על בסיס הנתונים המסופקים.

שם: ${member.full_name}
סיעה: ${member.faction_name}
תפקיד: ${member.role_he ?? 'חבר כנסת'}

הצעות חוק שהגיש/ה (${bills.length} בסה"כ, מוצגות ${Math.min(bills.length, 40)}):
${billLines || 'אין נתונים'}

הצבעות (${votes.length} מוצגות):
${voteLines || 'אין נתונים'}

כתבות חדשות אחרונות:
${newsLines || 'אין נתונים'}

על בסיס הנתונים לעיל, ספק ניתוח פוליטי בפורמט JSON בלבד (ללא טקסט נוסף):

{
  "left_right_score": <0–100, כאשר 0=שמאל קיצוני, 50=מרכז, 100=ימין קיצוני>,
  "extremism_score": <0–100, כאשר 0=מתון, 100=קיצוני>,
  "stance_women": <-2 עד 2, שלילי=שמרני/מתנגד, חיובי=פרוגרסיבי/תומך>,
  "stance_lgbt": <-2 עד 2>,
  "stance_military": <-2 עד 2, שלילי=שלומי/מתנגד, חיובי=ביטחוניסט/תומך>,
  "stance_democracy": <-2 עד 2, שלילי=פוגע בדמוקרטיה, חיובי=מגן על דמוקרטיה>,
  "propaganda_score": <0–100, עד כמה משתמש/ת בשיח מניפולטיבי/הסתה>,
  "hypocrisy_score": <0–100, עד כמה יש פער בין דברים שאמר/ה לבין הצבעות/חקיקה>,
  "political_summary": "<2–3 משפטים בעברית המסכמים את הפרופיל הפוליטי>",
  "stance_notes": {
    "women": "<משפט אחד בעברית המסביר את הניקוד>",
    "lgbt": "<משפט אחד>",
    "military": "<משפט אחד>",
    "democracy": "<משפט אחד>"
  },
  "propaganda_note": "<משפט אחד בעברית המסביר את ניקוד התעמולה>",
  "hypocrisy_note": "<משפט אחד בעברית המסביר את ניקוד הצביעות>"
}

חשוב: ענה JSON בלבד. בסס את הניתוח אך ורק על הנתונים המסופקים. אל תמציא מידע.`;

  // ── 4. Call Claude ────────────────────────────────────────────────────────
  let raw: Record<string, unknown>;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: 'אתה מנתח פוליטי אובייקטיבי. ענה תמיד ב-JSON בלבד, ללא כל טקסט נוסף לפני או אחרי.',
      messages: [{ role: 'user', content: prompt }],
    });
    const text = (msg.content[0] as { type: string; text: string }).text.trim();
    const jsonStr = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    raw = JSON.parse(jsonStr);
  } catch (err) {
    console.error('member-profile Claude error:', err);
    return NextResponse.json({ error: 'Failed to generate profile' }, { status: 500 });
  }

  // ── 5. Validate & clamp ───────────────────────────────────────────────────
  const clamp = (v: unknown, min: number, max: number) =>
    Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

  const row = {
    person_id:         personID,
    left_right_score:  clamp(raw.left_right_score,  0, 100),
    extremism_score:   clamp(raw.extremism_score,   0, 100),
    stance_women:      clamp(raw.stance_women,      -2, 2),
    stance_lgbt:       clamp(raw.stance_lgbt,       -2, 2),
    stance_military:   clamp(raw.stance_military,   -2, 2),
    stance_democracy:  clamp(raw.stance_democracy,  -2, 2),
    propaganda_score:  clamp(raw.propaganda_score,  0, 100),
    hypocrisy_score:   clamp(raw.hypocrisy_score,   0, 100),
    political_summary: String(raw.political_summary ?? ''),
    stance_notes:      raw.stance_notes ?? {},
    propaganda_note:   String(raw.propaganda_note ?? ''),
    hypocrisy_note:    String(raw.hypocrisy_note ?? ''),
    generated_at:      new Date().toISOString(),
  };

  // ── 6. Store in DB ────────────────────────────────────────────────────────
  await supabaseAdmin
    .from('member_political_profiles')
    .upsert(row, { onConflict: 'person_id' });

  return NextResponse.json(toProfile(row, false));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProfile(row: any, fromCache: boolean): MemberPoliticalProfile {
  return {
    personID:         row.person_id,
    leftRightScore:   row.left_right_score,
    extremismScore:   row.extremism_score,
    stanceWomen:      row.stance_women,
    stanceLgbt:       row.stance_lgbt,
    stanceMilitary:   row.stance_military,
    stanceDemocracy:  row.stance_democracy,
    propagandaScore:  row.propaganda_score,
    hypocrisyScore:   row.hypocrisy_score,
    politicalSummary: row.political_summary,
    stanceNotes:      row.stance_notes ?? {},
    propagandaNote:   row.propaganda_note,
    hypocrisyNote:    row.hypocrisy_note,
    generatedAt:      row.generated_at,
    fromCache,
  };
}
