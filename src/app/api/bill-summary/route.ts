/**
 * GET /api/bill-summary?billID=X
 *
 * Returns a rich AI summary for a specific bill.
 * - Checks bill_classifications for cached full_summary first.
 * - If missing: fetches bill details + all initiators, calls Claude Haiku,
 *   upserts the three summary columns, then returns the result.
 *
 * Response: {
 *   billID, name, fullSummary, benefitsSummary, concernsSummary,
 *   initiators: [{ name, nameEng, faction, isInitiator }],
 *   fromDB: boolean
 * }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Initiator {
  name: string;
  nameEng: string;
  faction: string;
  isInitiator: boolean;
}

async function generateSummaries(
  billName: string,
  knessetNum: number,
  initiators: Initiator[],
): Promise<{ fullSummary: string; benefitsSummary: string; concernsSummary: string }> {
  const initiatorList = initiators
    .map(i => `${i.name} (${i.faction || 'לא ידוע'})`)
    .join(', ');

  const prompt = `אתה מנתח הצעות חוק ישראליות. נתח את הצעת החוק הבאה וספק סיכום מפורט.

שם הצעת החוק: "${billName}"
כנסת: ${knessetNum}
מגישי ההצעה: ${initiatorList || 'לא ידוע'}

ענה ONLY בפורמט JSON תקני (ללא markdown, ללא הסברים):
{
  "full_summary": "סיכום של 2-3 משפטים בעברית שמסביר מה הצעת החוק עושה, מה השינוי המוצע, ומה ההקשר החקיקתי שלה",
  "benefits_summary": "משפט אחד בעברית המתאר מי נהנה מהצעת החוק הזו ולמה",
  "concerns_summary": "משפט אחד בעברית המתאר חששות אפשריים או מי עלול להיפגע מהצעת החוק"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

  try {
    const parsed = JSON.parse(clean);
    return {
      fullSummary:     parsed.full_summary     ?? '',
      benefitsSummary: parsed.benefits_summary ?? '',
      concernsSummary: parsed.concerns_summary ?? '',
    };
  } catch {
    return { fullSummary: '', benefitsSummary: '', concernsSummary: '' };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const billID = Number(searchParams.get('billID'));

  if (!billID) {
    return NextResponse.json({ error: 'Missing billID' }, { status: 400 });
  }

  try {
    // ── Step 1: Check cache ──────────────────────────────────────────────────
    const { data: existing } = await supabaseAdmin
      .from('bill_classifications')
      .select('full_summary, benefits_summary, concerns_summary')
      .eq('bill_id', billID)
      .single();

    // ── Step 2: Fetch bill + initiators (always needed for initiator list) ───
    const [billRes, initiatorsRes] = await Promise.all([
      supabaseAdmin
        .from('bills')
        .select('bill_id, name, knesset_num')
        .eq('bill_id', billID)
        .single(),
      supabaseAdmin
        .from('bill_initiators')
        .select('person_id, is_initiator')
        .eq('bill_id', billID),
    ]);

    const bill = billRes.data;
    if (!bill) {
      return NextResponse.json({ error: 'Bill not found' }, { status: 404 });
    }

    // Fetch member details for initiators
    const personIDs = (initiatorsRes.data ?? []).map(r => r.person_id);
    let initiators: Initiator[] = [];

    if (personIDs.length > 0) {
      const { data: members } = await supabaseAdmin
        .from('members')
        .select('person_id, full_name, full_name_eng, faction_name')
        .in('person_id', personIDs);

      const isInitiatorMap = new Map(
        (initiatorsRes.data ?? []).map(r => [r.person_id, r.is_initiator]),
      );

      initiators = (members ?? []).map(m => ({
        name:        m.full_name,
        nameEng:     m.full_name_eng,
        faction:     m.faction_name ?? '',
        isInitiator: isInitiatorMap.get(m.person_id) ?? false,
      }));

      // Sort: primary initiators first
      initiators.sort((a, b) => (b.isInitiator ? 1 : 0) - (a.isInitiator ? 1 : 0));
    }

    // ── Step 3: Return cached summaries if they exist ────────────────────────
    if (existing?.full_summary) {
      return NextResponse.json({
        billID,
        name:            bill.name,
        fullSummary:     existing.full_summary,
        benefitsSummary: existing.benefits_summary ?? '',
        concernsSummary: existing.concerns_summary ?? '',
        initiators,
        fromDB: true,
      });
    }

    // ── Step 4: Generate summaries with Claude Haiku ─────────────────────────
    const summaries = await generateSummaries(
      bill.name ?? '',
      bill.knesset_num,
      initiators,
    );

    // ── Step 5: Upsert into bill_classifications ─────────────────────────────
    await supabaseAdmin
      .from('bill_classifications')
      .upsert(
        {
          bill_id:          billID,
          full_summary:     summaries.fullSummary,
          benefits_summary: summaries.benefitsSummary,
          concerns_summary: summaries.concernsSummary,
        },
        { onConflict: 'bill_id' },
      );

    return NextResponse.json({
      billID,
      name:            bill.name,
      fullSummary:     summaries.fullSummary,
      benefitsSummary: summaries.benefitsSummary,
      concernsSummary: summaries.concernsSummary,
      initiators,
      fromDB: false,
    });

  } catch (err) {
    console.error('bill-summary error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
