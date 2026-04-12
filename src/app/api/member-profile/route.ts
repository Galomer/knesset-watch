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
  stanceWomen: number;          // -2 to 2
  stanceLgbt: number;
  stanceDemocracy: number;
  stanceLiberalism: number;
  stanceArmy: number;
  stanceSettlements: number;
  propagandaScore: number;      // 0–100
  hypocrisyScore: number;       // 0–100
  politicalSummary: string;
  stanceNotes: Record<string, string>;
  propagandaNote: string;
  hypocrisyNote: string;
  primaryBeneficiaries: string[];   // population groups this MK mainly serves
  primaryHurt: string[];            // population groups this MK's agenda disadvantages
  populationNote: string;           // one sentence explaining the population pattern
  generatedAt: string;
  fromCache: boolean;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const CACHE_TTL_DAYS = 30;

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
  const [memberRes, billsRes, votesRes, newsRes, classRes] = await Promise.allSettled([
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

    // Get bill IDs for this member, then fetch classifications separately
    supabaseAdmin
      .from('bill_initiators')
      .select('bill_id')
      .eq('person_id', personID)
      .limit(200),
  ]);

  const member = memberRes.status === 'fulfilled' ? memberRes.value.data : null;
  if (!member) return NextResponse.json({ error: 'Member not found' }, { status: 404 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const bills = billsRes.status === 'fulfilled' ? (billsRes.value.data ?? []) as any[] : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const votes = votesRes.status === 'fulfilled' ? (votesRes.value.data ?? []) as any[] : [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const news  = newsRes.status  === 'fulfilled' ? (newsRes.value.data  ?? []) as any[] : [];

  // Fetch classifications for this member's bills (two-step: IDs → classifications)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billIDRows = classRes.status === 'fulfilled' ? (classRes.value.data ?? []) as any[] : [];
  const memberBillIDs = billIDRows.map((r: any) => r.bill_id).filter(Boolean);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let classifiedBills: any[] = [];
  if (memberBillIDs.length > 0) {
    const { data: classData } = await supabaseAdmin
      .from('bill_classifications')
      .select('bill_id, benefits, hurts, seniors, children, lgbt, ultra_orthodox, religious, liberals, women, soldiers, working_class, unemployed, arabs, druze, secular')
      .in('bill_id', memberBillIDs.slice(0, 200));
    classifiedBills = classData ?? [];
  }

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

  // Aggregate population impact from classified bills
  const groupNames = ['seniors','children','lgbt','ultra_orthodox','religious','liberals','women','soldiers','working_class','unemployed','arabs','druze','secular'];
  const groupCounts: Record<string, { pro: number; anti: number }> = {};
  for (const g of groupNames) groupCounts[g] = { pro: 0, anti: 0 };
  const benefitCount: Record<string, number> = {};
  const hurtCount: Record<string, number> = {};

  for (const row of classifiedBills) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const c = (row as any).bill_classifications;
    if (!c) continue;
    for (const g of groupNames) {
      if (c[g] === 'pro')  groupCounts[g].pro++;
      if (c[g] === 'anti') groupCounts[g].anti++;
    }
    for (const b of (c.benefits ?? [])) benefitCount[b] = (benefitCount[b] ?? 0) + 1;
    for (const h of (c.hurts ?? []))    hurtCount[h]    = (hurtCount[h]    ?? 0) + 1;
  }

  const topBenefited = Object.entries(benefitCount).sort((a,b) => b[1]-a[1]).slice(0,5).map(([g,n]) => `${g}(${n})`).join(', ');
  const topHurt      = Object.entries(hurtCount).sort((a,b) => b[1]-a[1]).slice(0,5).map(([g,n]) => `${g}(${n})`).join(', ');
  const groupSummary = groupNames
    .map(g => `${g}: +${groupCounts[g].pro}/-${groupCounts[g].anti}`)
    .filter(s => !s.endsWith('+0/-0'))
    .join(', ');

  const populationContext = classifiedBills.length > 0
    ? `\nניתוח השפעה על אוכלוסיות (מ-${classifiedBills.length} חוקים מסווגים):
קבוצות מרוויחות: ${topBenefited || 'אין'}
קבוצות נפגעות: ${topHurt || 'אין'}
פירוט: ${groupSummary || 'אין'}`
    : '';

  const prompt = `נתח את חבר/ת הכנסת הבא/ה על בסיס הנתונים המסופקים בלבד.

שם: ${member.full_name}
סיעה: ${member.faction_name}
תפקיד: ${member.role_he ?? 'חבר כנסת'}

הצעות חוק (${bills.length} בסה"כ, מוצגות ${Math.min(bills.length, 40)}):
${billLines || 'אין נתונים'}

הצבעות (${votes.length} מוצגות):
${voteLines || 'אין נתונים'}

כתבות אחרונות:
${newsLines || 'אין נתונים'}
${populationContext}

---
קונצנזוסים ישראליים שיש לקחת בחשבון:
- טבח ה-7 באוקטובר 2023 הוא הטבח החמור ביותר מאז קום המדינה
- הצורך להגן על ישראל מפני איראן, חיזבאללה וחמאס הוא קונצנזוס רחב
- שחרור החטופים הוא ערך לאומי עליון
- שמירה על הדמוקרטיה ועצמאות הרשות השופטת היא ציפייה של רוב הציבור

הגדרות העמדות (-2 עד 2):
• stance_women: -2=מתנגד חזק לשוויון מגדרי, 0=ניטרלי, 2=מוביל שוויון מגדרי ופמיניזם
• stance_lgbt: -2=מתנגד חזק לזכויות להט"ב, 0=ניטרלי, 2=תומך חזק בזכויות להט"ב
• stance_democracy: -2=פועל נגד מוסדות הדמוקרטיה/שלטון חוק, 0=ניטרלי, 2=מגן נחרץ על הדמוקרטיה
• stance_liberalism: -2=שמרן חברתי מובהק (ערכים מסורתיים, דת ומדינה), 0=מרכז, 2=ליברל חברתי מובהק (הפרדת דת ומדינה, חופש אישי)
• stance_army: -2=שלומי/מתנגד להפעלת כוח צבאי, 0=מאוזן, 2=ביטחוניסט חזק התומך בצה"ל ובפעולות ביטחוניות
• stance_settlements: -2=מתנגד נחרץ להתנחלויות, 0=ניטרלי/פרגמטי, 2=תומך חזק בהרחבת ההתנחלויות

ניקוד תעמולה (0–100): עד כמה חה"כ משתמש בהסתה, שקרים או מניפולציות. 0=עניני לחלוטין, 100=תעמולה מסוכנת.
ניקוד צביעות (0–100): עד כמה יש פער בין הצהרות פומביות לבין הצבעות/חקיקה. 0=עקבי לחלוטין, 100=סתירה מוחלטת.

חשוב: בשדה primary_beneficiaries — ציין את האוכלוסיות שהחקיקה והעמדות של חה"כ זה בעיקר מיטיבות עמן. היה מפורש ואמיץ — אם חה"כ מסיעה חרדית שמקדם פטור מגיוס ותקציבי ישיבות, כתוב ultra_orthodox. אם חה"כ שמקדם הגנות להט"ב, כתוב lgbt. בסס על הנתונים בלבד.

ענה JSON בלבד:
{
  "stance_women": <-2 עד 2>,
  "stance_lgbt": <-2 עד 2>,
  "stance_democracy": <-2 עד 2>,
  "stance_liberalism": <-2 עד 2>,
  "stance_army": <-2 עד 2>,
  "stance_settlements": <-2 עד 2>,
  "propaganda_score": <0–100>,
  "hypocrisy_score": <0–100>,
  "political_summary": "<2–3 משפטים בעברית, ניתוח עמדות ואג'נדה — כולל לאיזו אוכלוסייה הוא בעיקר פועל>",
  "stance_notes": {
    "women": "<משפט אחד בעברית>",
    "lgbt": "<משפט אחד בעברית>",
    "democracy": "<משפט אחד בעברית>",
    "liberalism": "<משפט אחד בעברית>",
    "army": "<משפט אחד בעברית>",
    "settlements": "<משפט אחד בעברית>"
  },
  "propaganda_note": "<משפט אחד בעברית>",
  "hypocrisy_note": "<משפט אחד בעברית>",
  "primary_beneficiaries": ["רשימת מפתחות באנגלית מתוך: seniors,children,lgbt,ultra_orthodox,religious,liberals,women,soldiers,working_class,unemployed,arabs,druze,secular — מסודרת לפי חשיבות"],
  "primary_hurt": ["קבוצות שהאג'נדה שלו פוגעת בהן — אותם מפתחות"],
  "population_note": "<משפט אחד בעברית המסביר בבירור לאיזו אוכלוסייה חה"כ זה בעיקר פועל ומי לא נהנה מסדר היום שלו>"
}

בסס את הניתוח אך ורק על הנתונים המסופקים. אל תמציא מידע שאינו בנתונים.`;

  // ── 4. Call Claude ────────────────────────────────────────────────────────
  let raw: Record<string, unknown>;
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: `אתה מנתח פוליטי המדמה ישראלי עובד ורציונלי — אדם שרוצה לחיות בשלום ובכבוד, מחויב לביטחון ישראל ולדמוקרטיה, מזועזע מטבח ה-7 באוקטובר, ומצפה מנבחרי ציבור לעקביות ויושר. הנך מנתח מעמדות של הציבור הישראלי הרחב — לא ימין קיצוני ולא שמאל קיצוני. ענה תמיד ב-JSON בלבד, ללא כל טקסט נוסף.`,
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
    person_id:           personID,
    left_right_score:    50, // kept in DB for compatibility but not used in UI
    extremism_score:     50,
    stance_women:        clamp(raw.stance_women,       -2, 2),
    stance_lgbt:         clamp(raw.stance_lgbt,        -2, 2),
    stance_military:     0,  // replaced by stance_army
    stance_democracy:    clamp(raw.stance_democracy,   -2, 2),
    stance_liberalism:   clamp(raw.stance_liberalism,  -2, 2),
    stance_army:         clamp(raw.stance_army,        -2, 2),
    stance_settlements:  clamp(raw.stance_settlements, -2, 2),
    propaganda_score:  clamp(raw.propaganda_score,  0, 100),
    hypocrisy_score:   clamp(raw.hypocrisy_score,   0, 100),
    political_summary:       String(raw.political_summary ?? ''),
    stance_notes:            raw.stance_notes ?? {},
    propaganda_note:         String(raw.propaganda_note ?? ''),
    hypocrisy_note:          String(raw.hypocrisy_note ?? ''),
    primary_beneficiaries:   Array.isArray(raw.primary_beneficiaries) ? raw.primary_beneficiaries : [],
    primary_hurt:            Array.isArray(raw.primary_hurt) ? raw.primary_hurt : [],
    population_note:         String(raw.population_note ?? ''),
    generated_at:            new Date().toISOString(),
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
    personID:           row.person_id,
    stanceWomen:        row.stance_women,
    stanceLgbt:         row.stance_lgbt,
    stanceDemocracy:    row.stance_democracy,
    stanceLiberalism:   row.stance_liberalism ?? 0,
    stanceArmy:         row.stance_army ?? 0,
    stanceSettlements:  row.stance_settlements ?? 0,
    propagandaScore:    row.propaganda_score,
    hypocrisyScore:     row.hypocrisy_score,
    politicalSummary:   row.political_summary,
    stanceNotes:        row.stance_notes ?? {},
    propagandaNote:         row.propaganda_note,
    hypocrisyNote:          row.hypocrisy_note,
    primaryBeneficiaries:   row.primary_beneficiaries ?? [],
    primaryHurt:            row.primary_hurt ?? [],
    populationNote:         row.population_note ?? '',
    generatedAt:            row.generated_at,
    fromCache,
  };
}
