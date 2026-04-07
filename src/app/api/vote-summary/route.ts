/**
 * GET /api/vote-summary?voteID=X&personID=Y
 *
 * Returns an AI summary for a specific vote + a note explaining why this
 * particular member voted the way they did.
 *
 * - The vote summary (what the resolution was about) is cached in
 *   vote_headers.ai_summary so it is generated only once per vote.
 * - The stance note is generated fresh each call (it's one sentence, cheap).
 *
 * Response: { voteID, voteSummary, stanceNote, fromCache: boolean }
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';

export const maxDuration = 30;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const RESULT_LABEL: Record<number, { he: string; en: string }> = {
  1: { he: 'בעד', en: 'voted FOR' },
  2: { he: 'נגד', en: 'voted AGAINST' },
  3: { he: 'נמנע', en: 'abstained' },
  4: { he: 'נעדר', en: 'was absent' },
};

async function generateVoteSummary(
  description: string,
  itemDesc: string | null,
  knessetNum: number,
): Promise<string> {
  const text = [description, itemDesc].filter(Boolean).join(' — ');
  const prompt = `אתה מסכם הצבעות בכנסת ישראל. תאר בשני-שלושה משפטים בעברית מה הייתה ההצבעה הזו ומה היה הנושא שהועלה.

נושא ההצבעה: "${text}"
כנסת: ${knessetNum}

ענה ONLY בפורמט JSON תקני (ללא markdown):
{"summary": "שני-שלושה משפטים בעברית המסבירים את נושא ההצבעה"}`;

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}';
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  try {
    return JSON.parse(clean).summary ?? '';
  } catch {
    return '';
  }
}

async function generateStanceNote(
  description: string,
  memberName: string,
  factionName: string,
  result: number,
): Promise<string> {
  const resultEn = RESULT_LABEL[result]?.en ?? 'voted';
  const resultHe = RESULT_LABEL[result]?.he ?? 'הצביע';

  const prompt = `חבר/ת כנסת ${memberName} מסיעת "${factionName}" ${resultHe} בהצבעה על: "${description}".

כתוב משפט אחד קצר בעברית שמנסה להסביר מדוע חבר/ת הכנסת הזה/ה ${resultHe} כך — בהתחשב בסיעתו/ה ובנושא ההצבעה. אם לא ניתן לדעת בוודאות, ציין זאת בעדינות.

ענה ONLY בפורמט JSON תקני (ללא markdown):
{"note": "משפט אחד בעברית"}

(Member ${memberName} from "${factionName}" ${resultEn} on: "${description}")`;

  const res = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = res.content[0].type === 'text' ? res.content[0].text.trim() : '{}';
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
  try {
    return JSON.parse(clean).note ?? '';
  } catch {
    return '';
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const voteID   = Number(searchParams.get('voteID'));
  const personID = Number(searchParams.get('personID'));

  if (!voteID || !personID) {
    return NextResponse.json({ error: 'voteID and personID required' }, { status: 400 });
  }

  try {
    // ── Fetch vote header + member info in parallel ───────────────────────────
    const [voteRes, memberRes, memberVoteRes] = await Promise.all([
      supabaseAdmin
        .from('vote_headers')
        .select('vote_id, description, item_desc, knesset_num, ai_summary, is_accepted, vote_date')
        .eq('vote_id', voteID)
        .single(),
      supabaseAdmin
        .from('members')
        .select('full_name, full_name_eng, faction_name')
        .eq('person_id', personID)
        .single(),
      supabaseAdmin
        .from('member_votes')
        .select('vote_result')
        .eq('vote_id', voteID)
        .eq('person_id', personID)
        .single(),
    ]);

    const vote   = voteRes.data;
    const member = memberRes.data;

    if (!vote) {
      return NextResponse.json({ error: 'Vote not found' }, { status: 404 });
    }

    const result     = memberVoteRes.data?.vote_result ?? 0;
    const memberName = member?.full_name ?? 'חבר כנסת';
    const faction    = member?.faction_name ?? '';
    const description = vote.description ?? vote.item_desc ?? '';

    // ── Get or generate vote summary (cached per vote) ────────────────────────
    let voteSummary = vote.ai_summary;
    let fromCache   = true;

    if (!voteSummary && description) {
      fromCache    = false;
      voteSummary  = await generateVoteSummary(description, vote.item_desc ?? null, vote.knesset_num);

      if (voteSummary) {
        await supabaseAdmin
          .from('vote_headers')
          .update({ ai_summary: voteSummary })
          .eq('vote_id', voteID);
      }
    }

    // ── Generate stance note (fresh, member-specific) ─────────────────────────
    let stanceNote = '';
    if (description && result > 0 && result <= 3) {
      stanceNote = await generateStanceNote(description, memberName, faction, result);
    }

    return NextResponse.json({ voteID, voteSummary, stanceNote, fromCache });

  } catch (err) {
    console.error('vote-summary error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
