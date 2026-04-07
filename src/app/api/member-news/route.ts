/**
 * GET /api/member-news?personID=X
 *
 * Returns recent news articles about an MK.
 * - Checks DB cache first (TTL: 12 hours)
 * - On miss: fetches Google News RSS by member name
 * - Generates an AI summary per article using Claude Haiku
 * - Caches results in member_news table
 *
 * Returns: { articles: NewsArticle[], fromCache: boolean }
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import Anthropic from '@anthropic-ai/sdk';

export interface NewsArticle {
  id?: number;
  title: string;
  url: string;
  source: string;
  publishedAt: string | null;
  snippet: string;
  aiSummary: string;
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CACHE_TTL_HOURS = 12;
const MAX_ARTICLES = 8;

// ── Parse Google News RSS ─────────────────────────────────────────────────────

function parseRSS(xml: string): { title: string; url: string; source: string; publishedAt: string | null; snippet: string }[] {
  const items: { title: string; url: string; source: string; publishedAt: string | null; snippet: string }[] = [];

  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);
  for (const match of itemMatches) {
    const block = match[1];

    const titleMatch = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
                       block.match(/<title>(.*?)<\/title>/);
    const linkMatch  = block.match(/<link>(.*?)<\/link>/);
    const pubMatch   = block.match(/<pubDate>(.*?)<\/pubDate>/);
    const sourceMatch = block.match(/<source[^>]*>(.*?)<\/source>/);
    const descMatch  = block.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) ||
                       block.match(/<description>(.*?)<\/description>/);

    const rawTitle = titleMatch?.[1]?.trim() ?? '';
    const rawURL   = linkMatch?.[1]?.trim() ?? '';

    if (!rawTitle || !rawURL) continue;

    // Strip source suffix from title (Google News appends " - Source Name")
    const titleParts = rawTitle.split(' - ');
    const title = titleParts.slice(0, -1).join(' - ') || rawTitle;

    // Extract plain text snippet from description HTML
    const rawDesc = descMatch?.[1] ?? '';
    const snippet = rawDesc
      .replace(/<[^>]+>/g, ' ')
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ').trim()
      .slice(0, 300);

    items.push({
      title,
      url: rawURL,
      source: sourceMatch?.[1]?.trim() ?? titleParts[titleParts.length - 1] ?? '',
      publishedAt: pubMatch?.[1] ? new Date(pubMatch[1]).toISOString() : null,
      snippet,
    });

    if (items.length >= MAX_ARTICLES) break;
  }

  return items;
}

// ── AI summary for one article ────────────────────────────────────────────────

async function summariseArticle(memberName: string, title: string, snippet: string): Promise<string> {
  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `כתבה על חבר הכנסת ${memberName}:
כותרת: ${title}
תקציר: ${snippet}

סכם בשני משפטים קצרים בעברית מה נאמר או נעשה על ידי חבר הכנסת בכתבה זו. התייחס רק למה שכתוב. אל תוסיף מידע.`,
      }],
    });
    return (msg.content[0] as { type: string; text: string }).text?.trim() ?? '';
  } catch {
    return '';
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const personID = Number(searchParams.get('personID'));
  if (!personID) return NextResponse.json({ articles: [], fromCache: false }, { status: 400 });

  // ── 1. Check cache ───────────────────────────────────────────────────────
  const cutoff = new Date(Date.now() - CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { data: cached } = await supabaseAdmin
    .from('member_news')
    .select('id, title, url, source, published_at, snippet, ai_summary')
    .eq('person_id', personID)
    .gte('fetched_at', cutoff)
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(MAX_ARTICLES);

  if (cached && cached.length > 0) {
    const articles: NewsArticle[] = cached.map(r => ({
      id: r.id,
      title: r.title,
      url: r.url,
      source: r.source ?? '',
      publishedAt: r.published_at,
      snippet: r.snippet ?? '',
      aiSummary: r.ai_summary,
    }));
    return NextResponse.json({ articles, fromCache: true });
  }

  // ── 2. Get member name from DB ───────────────────────────────────────────
  const { data: memberRow } = await supabaseAdmin
    .from('members')
    .select('full_name, full_name_eng')
    .eq('person_id', personID)
    .single();

  if (!memberRow) return NextResponse.json({ articles: [], fromCache: false });

  const memberName = memberRow.full_name;

  // ── 3. Fetch Google News RSS ─────────────────────────────────────────────
  let rawArticles: ReturnType<typeof parseRSS> = [];
  try {
    const query = encodeURIComponent(`"${memberName}"`);
    const rssURL = `https://news.google.com/rss/search?q=${query}&hl=he&gl=IL&ceid=IL:he`;
    const res = await fetch(rssURL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; KnessetWatch/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const xml = await res.text();
      rawArticles = parseRSS(xml);
    }
  } catch { /* return empty if RSS fails */ }

  if (rawArticles.length === 0) {
    return NextResponse.json({ articles: [], fromCache: false });
  }

  // ── 4. Generate AI summaries in parallel ────────────────────────────────
  const summaries = await Promise.all(
    rawArticles.map(a => summariseArticle(memberName, a.title, a.snippet))
  );

  // ── 5. Store in DB ───────────────────────────────────────────────────────
  const rows = rawArticles.map((a, i) => ({
    person_id: personID,
    title: a.title,
    url: a.url,
    source: a.source,
    published_at: a.publishedAt,
    snippet: a.snippet,
    ai_summary: summaries[i],
    fetched_at: new Date().toISOString(),
  }));

  try {
    await supabaseAdmin
      .from('member_news')
      .upsert(rows, { onConflict: 'person_id,url' });
  } catch { /* don't fail the request if cache write fails */ }

  const articles: NewsArticle[] = rawArticles.map((a, i) => ({
    title: a.title,
    url: a.url,
    source: a.source,
    publishedAt: a.publishedAt,
    snippet: a.snippet,
    aiSummary: summaries[i],
  }));

  return NextResponse.json({ articles, fromCache: false });
}
