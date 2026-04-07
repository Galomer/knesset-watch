import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { summary: 'AI summaries require an API key. Please add ANTHROPIC_API_KEY to your .env.local file.' },
      { status: 200 }
    );
  }

  const { name, nameHe, party, role, lang } = await req.json();

  const isHebrew = lang === 'he';

  const prompt = isHebrew
    ? `אתה עוזר שמסכם מידע על פוליטיקאים ישראלים בצורה פשוטה ונגישה לכל אדם.

כתוב סיכום קצר (3-4 משפטים) על ${nameHe || name}, ${role} מסיעת ${party}.
כלול:
- מה הוא/היא מייצגים ומה עמדותיהם המרכזיות
- הישגים או פעילות בולטת בכנסת
- נושאים שהם מקדמים

כתוב בעברית פשוטה וברורה, ללא ז'רגון פוליטי.`
    : `You are a helpful assistant that summarizes information about Israeli politicians in simple, accessible language for everyday people.

Write a brief summary (3-4 sentences) about ${name}, ${role} from the ${party} party.
Include:
- What they stand for and their key positions
- Notable achievements or activity in the Knesset
- Issues they champion

Write in simple, clear English without political jargon.`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = message.content[0].type === 'text' ? message.content[0].text : '';
    return NextResponse.json({ summary });
  } catch (err) {
    console.error('Claude API error:', err);
    return NextResponse.json({ summary: 'Unable to generate summary at this time.' }, { status: 200 });
  }
}
