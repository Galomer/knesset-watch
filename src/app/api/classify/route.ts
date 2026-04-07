/**
 * POST /api/classify?knesset=25  — classify next batch of unclassified bills
 * GET  /api/classify             — progress stats
 *
 * Sends batches of 20 bill titles to Claude Haiku.
 * Run repeatedly until response contains "done": true.
 * Cost: ~$1-2 to classify all 7,296 K25 bills.
 *
 * Protected by: Authorization: Bearer <SYNC_SECRET>
 */

import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase';
import { GROUPS } from '@/lib/classifications';

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const BATCH_SIZE = 20;

function isAuthorized(req: Request): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '');
  return token === process.env.CRON_SECRET || token === process.env.SYNC_SECRET;
}

function buildPrompt(bills: { bill_id: number; name: string; knesset_num: number; status_id: number | null }[]): string {
  const list = bills
    .map((b, i) => `${i + 1}. [ID:${b.bill_id}] "${b.name}" — כנסת ${b.knesset_num}${b.status_id === 118 ? ' (הפך לחוק)' : ''}`)
    .join('\n');

  return `You are classifying Israeli Knesset bills by their societal impact on population groups in Israel.
Analyze each Hebrew bill title and classify it.
If a title is too vague or procedural, use "neutral" for all stances and "unknown" for financial_impact.

Bills:
${list}

Return ONLY a valid JSON array — no markdown, no explanation — with exactly ${bills.length} objects:
[
  {
    "bill_id": <number>,
    "summary": "one sentence in Hebrew (max 20 words) explaining what this bill does",
    "benefits": ["group names that clearly benefit, from the list below"],
    "hurts": ["group names that are clearly hurt"],
    "financial_impact": "positive|negative|neutral|unknown",
    "financial_note": "one English sentence on impact to a middle-class Israeli family, or empty string",
    "stances": {
      "seniors": "pro|neutral|anti",
      "children": "pro|neutral|anti",
      "lgbt": "pro|neutral|anti",
      "ultra_orthodox": "pro|neutral|anti",
      "religious": "pro|neutral|anti",
      "liberals": "pro|neutral|anti",
      "women": "pro|neutral|anti",
      "soldiers": "pro|neutral|anti",
      "working_class": "pro|neutral|anti",
      "unemployed": "pro|neutral|anti",
      "arabs": "pro|neutral|anti",
      "druze": "pro|neutral|anti",
      "secular": "pro|neutral|anti"
    },
    "confidence": "high|medium|low"
  }
]`;
}

async function classifyBatch(
  bills: { bill_id: number; name: string; knesset_num: number; status_id: number | null }[]
): Promise<number> {
  const response = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{ role: 'user', content: buildPrompt(bills) }],
  });

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '[]';
  const clean = raw.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();

  let parsed: {
    bill_id: number;
    summary?: string;
    benefits?: string[];
    hurts?: string[];
    financial_impact?: string;
    financial_note?: string;
    stances?: Record<string, string>;
    confidence?: string;
  }[] = [];

  try {
    parsed = JSON.parse(clean);
  } catch {
    console.error('Parse error for batch, using neutral fallbacks. Raw:', clean.slice(0, 300));
    parsed = bills.map(b => ({ bill_id: b.bill_id }));
  }

  // Map Claude's output to DB rows
  const rows = bills.map(b => {
    const c = parsed.find(p => p.bill_id === b.bill_id);
    return {
      bill_id:          b.bill_id,
      summary:          c?.summary ?? '',
      benefits:         c?.benefits ?? [],
      hurts:            c?.hurts ?? [],
      financial_impact: c?.financial_impact ?? 'unknown',
      financial_note:   c?.financial_note ?? '',
      confidence:       c?.confidence ?? 'low',
      classified_at:    new Date().toISOString(),
      ...Object.fromEntries(GROUPS.map(g => [g, c?.stances?.[g] ?? 'neutral'])),
    };
  });

  const { error } = await supabaseAdmin
    .from('bill_classifications')
    .upsert(rows, { onConflict: 'bill_id' });

  if (error) throw new Error(`DB upsert failed: ${error.message}`);
  return rows.length;
}

// ── GET: progress ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const knesset = Number(searchParams.get('knesset') ?? '25');

  const [{ count: total }, { count: classified }] = await Promise.all([
    supabaseAdmin.from('bills').select('*', { count: 'exact', head: true }).eq('knesset_num', knesset),
    supabaseAdmin.from('bill_classifications')
      .select('bill_id, bills!inner(knesset_num)', { count: 'exact', head: true })
      .eq('bills.knesset_num', knesset),
  ]);

  const t = total ?? 0;
  const d = classified ?? 0;
  return NextResponse.json({ total: t, classified: d, remaining: t - d, pct: t > 0 ? Math.round((d / t) * 100) : 0 });
}

// ── POST: classify next batch ─────────────────────────────────────────────────

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const knesset = Number(searchParams.get('knesset') ?? '25');

  const started = Date.now();
  const deadline = started + 50_000;
  let totalClassified = 0;

  try {
    while (Date.now() < deadline) {
      // Use the DB function (defined in schema_v3.sql) to find unclassified bills
      const { data: batch, error } = await supabaseAdmin.rpc('get_unclassified_bills', {
        p_knesset: knesset,
        p_limit: BATCH_SIZE,
      });

      if (error) throw new Error(`RPC error: ${error.message}`);
      if (!batch || batch.length === 0) {
        return NextResponse.json({ ok: true, done: true, classified: totalClassified, durationMs: Date.now() - started });
      }

      const count = await classifyBatch(batch);
      totalClassified += count;
    }

    return NextResponse.json({ ok: true, done: false, classified: totalClassified, durationMs: Date.now() - started });

  } catch (err) {
    console.error('Classify error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
