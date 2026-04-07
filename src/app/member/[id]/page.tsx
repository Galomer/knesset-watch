'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useLang } from '@/lib/lang-context';
import { t } from '@/lib/translations';
import AttendanceBar from '@/components/AttendanceBar';
import { RealMember, RealBill } from '@/lib/knesset-api';
import ImpactGrid from '@/components/ImpactGrid';
import type { ImpactData } from '@/app/api/impact/route';
import type { BillClassification } from '@/lib/classifications';
import { ArrowLeft, ArrowRight, Sparkles, Loader2, RefreshCw, ExternalLink, ThumbsUp, ThumbsDown, Minus, AlertCircle, ChevronDown, ChevronUp, CheckCircle, Clock, XCircle, Newspaper, ShieldAlert, Scale } from 'lucide-react';
import type { NewsArticle } from '@/app/api/member-news/route';
import type { MemberPoliticalProfile } from '@/app/api/member-profile/route';
import { GROUPS, GROUP_LABEL, STANCE_COLOR, FINANCIAL_COLOR, type Stance, type FinancialImpact } from '@/lib/classifications';

interface RealVote {
  voteID: number;
  knessetNum: number;
  date: string | null;
  billName: string | null;    // sess_item_dscr — the agenda item / bill title
  voteAction: string | null;  // vote_item_dscr — "אישור החוק", "הסתייגות", etc.
  result: 0 | 1 | 2 | 3 | 4;
  isAccepted: boolean | null;
  totalFor: number;
  totalAgainst: number;
  totalAbstain: number;
}

interface VoteSummaryData {
  voteID: number;
  voteSummary: string;
  stanceNote: string;
  fromCache: boolean;
}

interface BillWithClassification extends RealBill {
  Classification: BillClassification | null;
  StatusCategory: 'passed' | 'active' | 'stopped';
  StatusDescEn: string;
}

interface BillSummaryData {
  billID: number;
  name: string;
  fullSummary: string;
  benefitsSummary: string;
  concernsSummary: string;
  initiators: { name: string; nameEng: string; faction: string; isInitiator: boolean }[];
  fromDB: boolean;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500',
  'bg-red-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
  'bg-cyan-600', 'bg-rose-500', 'bg-amber-600', 'bg-lime-600',
];

export default function MemberProfile() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useLang();
  const tx = (key: string) => t[key]?.[lang] ?? key;
  const isRTL = lang === 'he';

  const [member, setMember] = useState<RealMember | null>(null);
  const [bills, setBills] = useState<BillWithClassification[]>([]);
  const [billFilter, setBillFilter] = useState<'all' | 'private' | 'gov' | 'passed'>('all');
  const [billCounts, setBillCounts] = useState<{
    proposed: number; passed: number;
    privateProposed: number; privatePassed: number;
    govProposed: number; govPassed: number;
    k25Proposed: number; k25Passed: number;
  } | null>(null);
  const [career, setCareer] = useState<{
    total: { proposed: number; passed: number };
    byKnesset: { knesset: number; proposed: number; passed: number }[];
  } | null>(null);
  const [impactData, setImpactData] = useState<ImpactData | null>(null);
  const [billsLoading, setBillsLoading] = useState(false);
  const [expandedBill, setExpandedBill] = useState<number | null>(null);
  const [billSummaries, setBillSummaries] = useState<Map<number, BillSummaryData | 'loading' | 'error'>>(new Map());
  const [votes, setVotes] = useState<RealVote[]>([]);
  const [votesLoading, setVotesLoading] = useState(false);
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [expandedVote, setExpandedVote] = useState<number | null>(null);
  const [voteSummaries, setVoteSummaries] = useState<Map<number, VoteSummaryData | 'loading' | 'error'>>(new Map());
  const [summary, setSummary] = useState('');
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [politicalProfile, setPoliticalProfile] = useState<MemberPoliticalProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileGenerated, setProfileGenerated] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/members');
        if (res.ok) {
          const all: RealMember[] = await res.json();
          const found = all.find(m => m.PersonID === Number(id)) ?? null;
          setMember(found);

          if (found) {
            setBillsLoading(true);
            setVotesLoading(true);
            // Fetch votes separately (may be slow on first load — triggers DB sync)
            fetch(`/api/member-votes?personID=${found.PersonID}&limit=20`)
              .then(r => r.json())
              .then(d => { setVotes(d.votes ?? []); setVoteCount(d.voteCount ?? null); })
              .catch(() => {})
              .finally(() => setVotesLoading(false));

            // Fetch news (non-blocking)
            setNewsLoading(true);
            fetch(`/api/member-news?personID=${found.PersonID}`)
              .then(r => r.json())
              .then(d => setNews(d.articles ?? []))
              .catch(() => {})
              .finally(() => setNewsLoading(false));

            Promise.all([
              fetch(`/api/member-bills?personID=${found.PersonID}`).then(r => r.json()),
              fetch(`/api/member-bills?personID=${found.PersonID}&count=1`).then(r => r.json()),
              fetch(`/api/member-bills?personID=${found.PersonID}&career=1`).then(r => r.json()),
              fetch(`/api/impact?type=member&personID=${found.PersonID}`).then(r => r.json()),
            ]).then(([billData, countData, careerData, impactResult]) => {
              setBills(billData);
              setBillCounts(countData);
              setCareer(careerData);
              setImpactData(impactResult?.classifiedBills > 0 ? impactResult : null);
              setBillsLoading(false);
            }).catch(() => setBillsLoading(false));
          }
        }
      } catch { /* show empty */ }
      finally { setLoading(false); }
    }
    load();
  }, [id]);

  async function generateSummary() {
    if (!member) return;
    setSummaryLoading(true);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: member.FullNameEng || member.FullName,
          nameHe: member.FullName,
          party: lang === 'he' ? member.FactionName : (member.FactionNameEng || member.FactionName),
          role: lang === 'he' ? member.RoleHe : (member.RoleEng || member.RoleHe),
          lang,
        }),
      });
      const data = await res.json();
      setSummary(data.summary);
    } catch {
      setSummary(lang === 'he' ? 'אירעה שגיאה ביצירת הסיכום.' : 'Failed to generate summary.');
    } finally {
      setSummaryLoading(false);
    }
  }

  function toggleVote(voteID: number) {
    if (expandedVote === voteID) {
      setExpandedVote(null);
      return;
    }
    setExpandedVote(voteID);
    if (!voteSummaries.has(voteID) && member) {
      setVoteSummaries(prev => new Map(prev).set(voteID, 'loading'));
      fetch(`/api/vote-summary?voteID=${voteID}&personID=${member.PersonID}`)
        .then(r => r.json())
        .then(data => setVoteSummaries(prev => new Map(prev).set(voteID, data)))
        .catch(() => setVoteSummaries(prev => new Map(prev).set(voteID, 'error')));
    }
  }

  function toggleBill(billID: number) {
    if (expandedBill === billID) {
      setExpandedBill(null);
      return;
    }
    setExpandedBill(billID);
    // Fetch summary only if we haven't yet
    if (!billSummaries.has(billID)) {
      setBillSummaries(prev => new Map(prev).set(billID, 'loading'));
      fetch(`/api/bill-summary?billID=${billID}`)
        .then(r => r.json())
        .then(data => setBillSummaries(prev => new Map(prev).set(billID, data)))
        .catch(() => setBillSummaries(prev => new Map(prev).set(billID, 'error')));
    }
  }

  async function generatePoliticalProfile() {
    if (!member || profileLoading) return;
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/member-profile?personID=${member.PersonID}`);
      const data = await res.json();
      setPoliticalProfile(data);
      setProfileGenerated(true);
    } catch {
      setProfileGenerated(true); // stop spinner even on error
    } finally {
      setProfileLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
        <RefreshCw size={20} className="animate-spin" />
        <span>{lang === 'he' ? 'טוען פרופיל חבר כנסת…' : 'Loading MK profile…'}</span>
      </div>
    );
  }
  if (!member) {
    return <div className="text-center py-20 text-gray-500">{tx('error')}</div>;
  }

  const name = lang === 'he' ? member.FullName : (member.FullNameEng || member.FullName);
  const party = lang === 'he' ? member.FactionName : (member.FactionNameEng || member.FactionName);
  const role = lang === 'he' ? member.RoleHe : (member.RoleEng || member.RoleHe);

  const words = name.split(' ').filter(Boolean);
  const initials = words.length >= 2 ? `${words[0][0]}${words[words.length - 1][0]}` : name.slice(0, 2);
  const color = AVATAR_COLORS[member.PersonID % AVATAR_COLORS.length];
  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  const forCount = votes.filter(v => v.result === 1).length;
  const againstCount = votes.filter(v => v.result === 2).length;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Back */}
      <Link href="/members" className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6 text-sm font-medium">
        <BackIcon size={16} />
        {lang === 'he' ? 'חזרה לרשימה' : 'Back to members'}
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        {/* Accent bar */}
        <div className={`h-1.5 w-full ${color.replace('bg-', 'bg-')}`} />
        <div className="p-6 flex items-start gap-5">
          {/* Avatar */}
          <div className={`w-16 h-16 rounded-2xl ${color} flex items-center justify-center text-white font-bold text-xl flex-shrink-0 shadow-sm`}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {party && (
                <span className="text-xs font-semibold bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full border border-blue-100">
                  {party}
                </span>
              )}
              {role && (
                <span className="text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
                  {role}
                </span>
              )}
              {member.GovMinistryName && (
                <span className="text-xs font-medium bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">
                  {member.GovMinistryName}
                </span>
              )}
            </div>
            {member.Email && (
              <a href={`mailto:${member.Email}`} className="text-xs text-gray-400 hover:text-blue-600 mt-2 inline-flex items-center gap-1 transition-colors">
                {member.Email}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">

        {/* Private bills */}
        <button
          onClick={() => { setBillFilter(f => f === 'private' ? 'all' : 'private'); setExpandedBill(null); }}
          className={`rounded-xl border p-4 text-center transition-all hover:shadow-sm ${
            billFilter === 'private'
              ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-300'
              : 'bg-white border-gray-200 hover:border-blue-300'
          }`}
        >
          {billCounts ? (
            <div className="text-2xl font-bold text-blue-600">{billCounts.privateProposed}</div>
          ) : (
            <div className="h-8 bg-gray-100 rounded animate-pulse mx-4 mb-1" />
          )}
          <div className="text-xs text-gray-600 mt-1 font-medium">{lang === 'he' ? 'הצ"ח פרטיות' : 'Private bills'}</div>
          {billCounts && billCounts.privatePassed > 0 && (
            <div className="text-xs text-green-600 mt-0.5">{billCounts.privatePassed} {lang === 'he' ? 'עברו' : 'passed'}</div>
          )}
          <div className="text-xs text-gray-400">{lang === 'he' ? 'כל הכנסות' : 'all Knessets'}</div>
        </button>

        {/* Government bills */}
        <button
          onClick={() => { setBillFilter(f => f === 'gov' ? 'all' : 'gov'); setExpandedBill(null); }}
          className={`rounded-xl border p-4 text-center transition-all hover:shadow-sm ${
            billFilter === 'gov'
              ? 'bg-purple-50 border-purple-400 ring-1 ring-purple-300'
              : 'bg-white border-gray-200 hover:border-purple-300'
          }`}
        >
          {billCounts ? (
            <div className="text-2xl font-bold text-purple-600">{billCounts.govProposed}</div>
          ) : (
            <div className="h-8 bg-gray-100 rounded animate-pulse mx-4 mb-1" />
          )}
          <div className="text-xs text-gray-600 mt-1 font-medium">{lang === 'he' ? 'הצ"ח ממשלתיות' : 'Gov. bills'}</div>
          {billCounts && billCounts.govPassed > 0 && (
            <div className="text-xs text-green-600 mt-0.5">{billCounts.govPassed} {lang === 'he' ? 'עברו' : 'passed'}</div>
          )}
          <div className="text-xs text-gray-400">{lang === 'he' ? 'כל הכנסות' : 'all Knessets'}</div>
        </button>

        {/* Total passed */}
        <button
          onClick={() => { setBillFilter(f => f === 'passed' ? 'all' : 'passed'); setExpandedBill(null); }}
          className={`rounded-xl border p-4 text-center transition-all hover:shadow-sm ${
            billFilter === 'passed'
              ? 'bg-green-50 border-green-400 ring-1 ring-green-300'
              : 'bg-white border-gray-200 hover:border-green-300'
          }`}
        >
          {billCounts ? (
            <div className="text-2xl font-bold text-green-600">{billCounts.passed}</div>
          ) : (
            <div className="h-8 bg-gray-100 rounded animate-pulse mx-4 mb-1" />
          )}
          <div className="text-xs text-gray-600 mt-1 font-medium">{tx('billsPassed')}</div>
          <div className="text-xs text-gray-400">{lang === 'he' ? 'כל הכנסות' : 'all Knessets'}</div>
        </button>

        {/* Votes — not a bill filter, just informational */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {voteCount !== null ? voteCount.toLocaleString() : votes.length}
          </div>
          <div className="text-xs text-gray-600 mt-1 font-medium">{lang === 'he' ? 'הצבעות' : 'Votes'}</div>
          <div className="text-xs text-gray-400">
            {forCount > 0 && <span className="text-green-600">{forCount}✓ </span>}
            {againstCount > 0 && <span className="text-red-500">{againstCount}✗</span>}
            {forCount === 0 && againstCount === 0 && <span>{lang === 'he' ? 'מהכנסות הקודמות' : 'prev. Knessets'}</span>}
          </div>
        </div>

      </div>

      {/* Career stats */}
      {(career?.byKnesset?.length ?? 0) > 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            {lang === 'he' ? 'קריירה מחוקקת לפי כנסת' : 'Legislative Career by Knesset'}
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {career!.byKnesset.length} {lang === 'he' ? 'כנסות' : 'Knessets'}
            </span>
          </h2>

          {/* Per-Knesset breakdown */}
          {(() => {
            const maxProposed = Math.max(...career!.byKnesset.map(k => k.proposed), 1);
            return (
              <div className="space-y-3">
                {career!.byKnesset.map(k => {
                  const barPct = Math.round((k.proposed / maxProposed) * 100);
                  const passPct = k.proposed > 0 ? Math.round((k.passed / k.proposed) * 100) : 0;
                  return (
                    <div key={k.knesset}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-600 flex items-center gap-1.5">
                          {lang === 'he' ? `כנסת ${k.knesset}` : `Knesset ${k.knesset}`}
                          {k.knesset === 25 && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0 rounded-full">
                              {lang === 'he' ? 'נוכחית' : 'current'}
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">
                          {k.proposed} {lang === 'he' ? 'הוגשו' : 'filed'}
                          {k.passed > 0 && (
                            <span className="text-green-600 font-medium">
                              {' '}· {k.passed} {lang === 'he' ? 'עברו' : 'passed'}
                              <span className="text-gray-400 font-normal"> ({passPct}%)</span>
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-blue-400 to-blue-500"
                          style={{ width: `${barPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* AI Summary */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <h2 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <Sparkles size={16} className="text-purple-500" />
          {tx('newsSummary')}
        </h2>
        {summary ? (
          <p className="text-gray-700 leading-relaxed text-sm" dir={isRTL ? 'rtl' : 'ltr'}>{summary}</p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <p className="text-gray-400 text-sm">
              {lang === 'he'
                ? 'סיכום AI על עמדות חה"כ, פעילותו ונושאים שהוא מקדם.'
                : "AI summary of this MK's positions, activity, and key issues."}
            </p>
            <button
              onClick={generateSummary}
              disabled={summaryLoading}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60 flex-shrink-0"
            >
              {summaryLoading
                ? <><Loader2 size={14} className="animate-spin" />{tx('generating')}</>
                : <><Sparkles size={14} />{tx('generateSummary')}</>}
            </button>
          </div>
        )}
      </div>

      {/* Population impact breakdown */}
      {impactData && (
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
          <h2 className="font-bold text-gray-800 mb-4">
            {lang === 'he' ? 'השפעה על קבוצות אוכלוסייה' : 'Impact on Population Groups'}
          </h2>
          <ImpactGrid data={[impactData]} lang={lang} singleRow />
        </div>
      )}

      {/* ── Political Profile ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold text-gray-800 flex items-center gap-2">
            <Scale size={16} className="text-blue-600" />
            {lang === 'he' ? 'פרופיל פוליטי (AI)' : 'Political Profile (AI)'}
          </h2>
          {!profileGenerated && !politicalProfile && (
            <button
              onClick={generatePoliticalProfile}
              disabled={profileLoading}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
            >
              {profileLoading
                ? <><Loader2 size={14} className="animate-spin" />{lang === 'he' ? 'מנתח…' : 'Analyzing…'}</>
                : <><Sparkles size={14} />{lang === 'he' ? 'נתח פרופיל' : 'Analyze Profile'}</>}
            </button>
          )}
          {politicalProfile && (
            <button
              onClick={generatePoliticalProfile}
              disabled={profileLoading}
              className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={12} className={profileLoading ? 'animate-spin' : ''} />
              {lang === 'he' ? 'רענן' : 'Refresh'}
            </button>
          )}
        </div>

        {!politicalProfile && !profileLoading && !profileGenerated && (
          <p className="text-sm text-gray-400">
            {lang === 'he'
              ? 'ניתוח עמדות פוליטיות, סולמות ליברליזם ושמרנות, עמדות בנושאים מרכזיים ומדדי תעמולה וצביעות — על בסיס חקיקה, הצבעות וכתבות.'
              : 'Analysis of political positions, liberal/conservative scale, stances on key issues, and propaganda/hypocrisy scores — based on bills, votes, and news.'}
          </p>
        )}

        {profileLoading && !politicalProfile && (
          <div className="flex items-center gap-2 text-gray-400 py-4">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">{lang === 'he' ? 'מנתח חקיקה, הצבעות וכתבות…' : 'Analyzing bills, votes and news…'}</span>
          </div>
        )}

        {politicalProfile && (() => {
          const p = politicalProfile;

          const stanceLabel = (v: number, he: boolean) => {
            if (v >=  2) return he ? 'תומך חזק' : 'Strong support';
            if (v >=  1) return he ? 'תומך'      : 'Supportive';
            if (v ===  0) return he ? 'ניטרלי'   : 'Neutral';
            if (v >= -1) return he ? 'מתנגד'     : 'Against';
            return                   he ? 'מתנגד חזק' : 'Strongly against';
          };
          const stanceColor = (v: number) =>
            v >=  2 ? 'bg-green-600 text-white' :
            v >=  1 ? 'bg-green-100 text-green-800' :
            v ===  0 ? 'bg-gray-100 text-gray-600' :
            v >= -1 ? 'bg-red-100 text-red-800' :
                      'bg-red-600 text-white';

          const issues = [
            { key: 'women',     val: p.stanceWomen,    he: 'נשים',       en: 'Women' },
            { key: 'lgbt',      val: p.stanceLgbt,     he: 'להט"ב',      en: 'LGBT+' },
            { key: 'military',  val: p.stanceMilitary, he: 'ביטחון',     en: 'Military' },
            { key: 'democracy', val: p.stanceDemocracy,he: 'דמוקרטיה',   en: 'Democracy' },
          ];

          return (
            <div className="space-y-5">
              {/* Political summary */}
              {p.politicalSummary && (
                <p className="text-sm text-gray-700 leading-relaxed" dir="rtl">{p.politicalSummary}</p>
              )}

              {/* Left–Right axis */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>{lang === 'he' ? '← שמאל' : '← Left'}</span>
                  <span className="font-medium text-gray-700">
                    {lang === 'he'
                      ? p.leftRightScore < 35 ? 'שמאל' : p.leftRightScore < 50 ? 'מרכז-שמאל' : p.leftRightScore < 65 ? 'מרכז-ימין' : 'ימין'
                      : p.leftRightScore < 35 ? 'Left' : p.leftRightScore < 50 ? 'Center-left' : p.leftRightScore < 65 ? 'Center-right' : 'Right'}
                  </span>
                  <span>{lang === 'he' ? 'ימין →' : 'Right →'}</span>
                </div>
                <div className="relative h-4 bg-gradient-to-r from-red-400 via-gray-200 to-blue-500 rounded-full">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-700 rounded-full shadow"
                    style={{ left: `calc(${p.leftRightScore}% - 8px)` }}
                  />
                </div>
              </div>

              {/* Extremism axis */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>{lang === 'he' ? '← מתון' : '← Moderate'}</span>
                  <span className="font-medium text-gray-700">
                    {lang === 'he'
                      ? p.extremismScore < 30 ? 'מתון' : p.extremismScore < 60 ? 'בינוני' : 'קיצוני'
                      : p.extremismScore < 30 ? 'Moderate' : p.extremismScore < 60 ? 'Assertive' : 'Extreme'}
                  </span>
                  <span>{lang === 'he' ? 'קיצוני →' : 'Extreme →'}</span>
                </div>
                <div className="relative h-4 bg-gradient-to-r from-green-200 via-yellow-300 to-red-600 rounded-full">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-gray-700 rounded-full shadow"
                    style={{ left: `calc(${p.extremismScore}% - 8px)` }}
                  />
                </div>
              </div>

              {/* Issue stances */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {lang === 'he' ? 'עמדות בנושאים מרכזיים' : 'Stances on Key Issues'}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {issues.map(issue => (
                    <div key={issue.key} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold text-gray-700">
                            {lang === 'he' ? issue.he : issue.en}
                          </span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${stanceColor(issue.val)}`}>
                            {stanceLabel(issue.val, lang === 'he')}
                          </span>
                        </div>
                        {p.stanceNotes[issue.key] && (
                          <p className="text-xs text-gray-500 leading-snug" dir="rtl">
                            {p.stanceNotes[issue.key]}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Propaganda + Hypocrisy bars */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: lang === 'he' ? 'תעמולה / הסתה' : 'Propaganda', score: p.propagandaScore, note: p.propagandaNote, color: 'bg-orange-500' },
                  { label: lang === 'he' ? 'צביעות' : 'Hypocrisy',         score: p.hypocrisyScore,  note: p.hypocrisyNote,  color: 'bg-purple-500' },
                ].map(({ label, score, note, color }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
                        <ShieldAlert size={11} />
                        {label}
                      </span>
                      <span className="text-xs font-bold text-gray-700">{score}/100</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
                    </div>
                    {note && <p className="text-xs text-gray-500 mt-1 leading-snug" dir="rtl">{note}</p>}
                  </div>
                ))}
              </div>

              <p className="text-xs text-gray-400">
                {lang === 'he'
                  ? `ניתוח AI מבוסס חקיקה, הצבעות וכתבות · ${new Date(p.generatedAt).toLocaleDateString('he-IL')}`
                  : `AI analysis based on bills, votes & news · ${new Date(p.generatedAt).toLocaleDateString('en-US')}`}
              </p>
            </div>
          );
        })()}
      </div>

      {/* Bills table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2 flex-wrap">
          <h2 className="font-bold text-gray-800">{tx('recentBills')}</h2>
          {billFilter === 'all' && billCounts && billCounts.proposed > 0 && (
            <span className="text-xs text-gray-500">
              {billCounts.proposed} {lang === 'he' ? 'סה"כ' : 'total'}
            </span>
          )}
          {billFilter === 'private' && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {lang === 'he' ? 'הצ"ח פרטיות' : 'Private bills'}
            </span>
          )}
          {billFilter === 'gov' && (
            <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
              {lang === 'he' ? 'הצ"ח ממשלתיות' : 'Government bills'}
            </span>
          )}
          {billFilter === 'passed' && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              {lang === 'he' ? 'חוקים שעברו' : 'Passed laws'}
            </span>
          )}
          {billFilter !== 'all' && (
            <button
              onClick={() => { setBillFilter('all'); setExpandedBill(null); }}
              className="text-xs text-gray-400 hover:text-gray-600 underline ms-1"
            >
              {lang === 'he' ? 'הצג הכל' : 'Show all'}
            </button>
          )}
        </div>

        {billsLoading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm p-5">
            <RefreshCw size={14} className="animate-spin" />
            {lang === 'he' ? 'טוען…' : 'Loading…'}
          </div>
        ) : bills.length === 0 ? (
          <p className="text-sm text-gray-400 p-5">
            {billFilter !== 'all'
              ? (lang === 'he' ? 'לא נמצאו הצעות חוק בקטגוריה זו' : 'No bills in this category')
              : (lang === 'he' ? 'לא נמצאו הצעות חוק' : 'No bills found')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right py-2.5 px-4 font-semibold text-gray-500 text-xs w-24">{lang === 'he' ? 'הוגשה' : 'Filed'}</th>
                <th className="text-right py-2.5 px-4 font-semibold text-gray-500 text-xs">{lang === 'he' ? 'שם הצעת החוק' : 'Bill Name'}</th>
                <th className="text-right py-2.5 px-4 font-semibold text-gray-500 text-xs w-20">{lang === 'he' ? 'כנסת' : 'Knesset'}</th>
                <th className="text-right py-2.5 px-4 font-semibold text-gray-500 text-xs w-36">{lang === 'he' ? 'סטטוס' : 'Status'}</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills
              .filter(b =>
                billFilter === 'private' ? !b.IsGovernment :
                billFilter === 'gov'     ?  b.IsGovernment :
                billFilter === 'passed'  ?  b.StatusID === 118 || b.StatusCategory === 'passed' :
                true
              )
              .map(b => {
                const c = b.Classification;
                const isExpanded = expandedBill === b.BillID;
                const cat = b.StatusCategory ?? (b.StatusID === 118 ? 'passed' : 'active');
                const statusDetail = lang === 'he' ? b.StatusDesc : b.StatusDescEn;
                const notableStances = c ? GROUPS.filter(g => c[g] !== 'neutral') : [];
                const summaryState = billSummaries.get(b.BillID);

                const catLabel = cat === 'passed'
                  ? (lang === 'he' ? 'עבר לחוק' : 'Passed')
                  : cat === 'stopped'
                  ? (lang === 'he' ? 'הוסר/נסגר' : 'Removed')
                  : (lang === 'he' ? 'פעיל' : 'Active');

                const catStyle =
                  cat === 'passed'  ? 'bg-green-100 text-green-800' :
                  cat === 'stopped' ? 'bg-red-100 text-red-700' :
                  'bg-yellow-100 text-yellow-800';

                const CatIcon = cat === 'passed' ? CheckCircle : cat === 'stopped' ? XCircle : Clock;

                return (
                  <>
                    <tr
                      key={b.BillID}
                      onClick={() => toggleBill(b.BillID)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="py-2.5 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {b.PublicationDate
                          ? new Date(b.PublicationDate).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '–'}
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="font-medium text-gray-900 leading-snug line-clamp-2" dir="rtl">{b.Name}</p>
                        {c?.summary && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1" dir="rtl">{c.summary}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-blue-600 whitespace-nowrap">
                        {lang === 'he' ? `כנסת ${b.KnessetNum}` : `K${b.KnessetNum}`}
                      </td>
                      <td className="py-2.5 px-4 min-w-36">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold ${catStyle}`}>
                          <CatIcon size={10} />
                          {catLabel}
                        </span>
                        {statusDetail && (
                          <p className="text-xs text-gray-400 mt-0.5 leading-tight" dir="rtl">{statusDetail}</p>
                        )}
                      </td>
                      <td className="py-2.5 px-2 text-gray-400">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr key={`${b.BillID}-exp`} className="bg-blue-50">
                        <td colSpan={5} className="px-5 py-4 border-t border-blue-100">

                          {/* Header: bill name + external link */}
                          <div className="flex items-start gap-2 mb-3">
                            <p className="font-semibold text-gray-900 text-sm leading-snug flex-1" dir="rtl">{b.Name}</p>
                            <a
                              href={`https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=${b.BillID}`}
                              target="_blank" rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline flex-shrink-0"
                            >
                              <ExternalLink size={12} />
                              {lang === 'he' ? 'אתר הכנסת' : 'Knesset site'}
                            </a>
                          </div>

                          {/* Meta */}
                          <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-3">
                            {b.PublicationDate && <span>📅 {new Date(b.PublicationDate).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}</span>}
                            <span>{b.IsGovernment ? (lang === 'he' ? 'ממשלתית' : 'Government bill') : (lang === 'he' ? 'פרטית' : 'Private bill')}</span>
                            <span>{lang === 'he' ? `כנסת ${b.KnessetNum}` : `Knesset ${b.KnessetNum}`}</span>
                          </div>

                          {/* AI summary section */}
                          {summaryState === 'loading' ? (
                            <div className="flex items-center gap-2 text-gray-400 text-xs py-2">
                              <Loader2 size={13} className="animate-spin" />
                              {lang === 'he' ? 'טוען סיכום AI…' : 'Generating AI summary…'}
                            </div>
                          ) : summaryState === 'error' ? (
                            <p className="text-xs text-red-400">{lang === 'he' ? 'שגיאה בטעינת הסיכום' : 'Failed to load summary'}</p>
                          ) : summaryState ? (
                            <div className="space-y-3">

                              {/* Full summary */}
                              {summaryState.fullSummary && (
                                <p className="text-sm text-gray-700 leading-relaxed" dir="rtl">{summaryState.fullSummary}</p>
                              )}

                              {/* Benefits / Concerns */}
                              {(summaryState.benefitsSummary || summaryState.concernsSummary) && (
                                <div className="space-y-1.5">
                                  {summaryState.benefitsSummary && (
                                    <div className="flex items-start gap-1.5">
                                      <span className="text-green-600 text-xs font-bold mt-0.5 flex-shrink-0">▲</span>
                                      <p className="text-xs text-gray-600" dir="rtl">{summaryState.benefitsSummary}</p>
                                    </div>
                                  )}
                                  {summaryState.concernsSummary && (
                                    <div className="flex items-start gap-1.5">
                                      <span className="text-red-500 text-xs font-bold mt-0.5 flex-shrink-0">▼</span>
                                      <p className="text-xs text-gray-600" dir="rtl">{summaryState.concernsSummary}</p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Initiators */}
                              {summaryState.initiators.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                                    {lang === 'he' ? 'מגישים' : 'Initiators'}
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {summaryState.initiators.map((ini, i) => (
                                      <span key={i} className={`text-xs rounded-full px-2 py-0.5 border ${ini.isInitiator ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-white border-gray-200 text-gray-600'}`} dir="rtl">
                                        {lang === 'he' ? ini.name : (ini.nameEng || ini.name)}
                                        {ini.faction && <span className="opacity-60"> · {ini.faction}</span>}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Population impact chips */}
                              {c && (
                                <div>
                                  <p className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                                    {lang === 'he' ? 'השפעה על אוכלוסיות' : 'Population impact'}
                                  </p>
                                  {c.financial_note && (
                                    <p className="text-xs text-gray-500 italic mb-1.5">{c.financial_note}</p>
                                  )}
                                  <div className="flex flex-wrap gap-1.5">
                                    {notableStances.map(g => (
                                      <span key={g} className={`text-xs px-2 py-0.5 rounded-full font-medium ${STANCE_COLOR[c[g] as Stance]}`}>
                                        {c[g] === 'pro' ? '▲' : '▼'} {lang === 'he' ? GROUP_LABEL[g].he : GROUP_LABEL[g].en}
                                      </span>
                                    ))}
                                    {c.financial_impact !== 'unknown' && (
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FINANCIAL_COLOR[c.financial_impact as FinancialImpact]}`}>
                                        {c.financial_impact === 'positive' ? '💚' : c.financial_impact === 'negative' ? '🔴' : '⚪'}
                                        {lang === 'he'
                                          ? c.financial_impact === 'positive' ? ' חיובי כלכלית' : c.financial_impact === 'negative' ? ' שלילי כלכלית' : ' ניטרלי'
                                          : ` Financially ${c.financial_impact}`}
                                      </span>
                                    )}
                                    {notableStances.length === 0 && c.financial_impact === 'unknown' && (
                                      <span className="text-xs text-gray-400">{lang === 'he' ? 'ניטרלי לכל הקבוצות' : 'Neutral across all groups'}</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Voting record */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <h2 className="font-bold text-gray-800">{tx('votingRecord')}</h2>
          {voteCount !== null && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
              {voteCount.toLocaleString()} {lang === 'he' ? 'הצבעות' : 'votes'}
            </span>
          )}
        </div>

        {/* K25 data notice */}
        <div className="flex items-start gap-2 bg-amber-50 border-b border-amber-100 px-5 py-2.5">
          <AlertCircle size={13} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800">
            {lang === 'he'
              ? 'נתוני הצבעות כנסת 25 טרם פורסמו ב-Open Data של הכנסת. מוצגות הצבעות מכנסות קודמות.'
              : 'K25 voting data not yet published in the Knesset Open Data API. Showing votes from previous Knessets.'}
          </p>
        </div>

        {votesLoading ? (
          <div className="flex items-center gap-2 text-gray-400 p-5">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">{lang === 'he' ? 'טוען הצבעות…' : 'Loading votes…'}</span>
          </div>
        ) : votes.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            {lang === 'he' ? 'לא נמצאו נתוני הצבעות.' : 'No voting records found.'}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right py-2.5 px-4 font-semibold text-gray-500 text-xs w-24">
                  {lang === 'he' ? 'תאריך' : 'Date'}
                </th>
                <th className="text-right py-2.5 px-4 font-semibold text-gray-500 text-xs">
                  {lang === 'he' ? 'נושא ההצבעה' : 'Vote subject'}
                </th>
                <th className="text-right py-2.5 px-4 font-semibold text-gray-500 text-xs w-28">
                  {lang === 'he' ? 'עמדת חה"כ' : 'Stance'}
                </th>
                <th className="text-right py-2.5 px-4 font-semibold text-gray-500 text-xs w-36">
                  {lang === 'he' ? 'תוצאה' : 'Result'}
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {votes.map(v => {
                const isExpanded = expandedVote === v.voteID;
                const summaryState = voteSummaries.get(v.voteID);

                const stance =
                  v.result === 1 ? { he: 'בעד',  en: 'For',       icon: <ThumbsUp size={11} />,   style: 'bg-green-100 text-green-800' } :
                  v.result === 2 ? { he: 'נגד',  en: 'Against',   icon: <ThumbsDown size={11} />, style: 'bg-red-100 text-red-800' } :
                  v.result === 3 ? { he: 'נמנע', en: 'Abstain',   icon: <Minus size={11} />,      style: 'bg-gray-100 text-gray-600' } :
                  v.result === 4 ? { he: 'נעדר', en: 'Absent',    icon: <Minus size={11} />,      style: 'bg-gray-50 text-gray-400' } :
                                   { he: 'בוטל', en: 'Cancelled', icon: <Minus size={11} />,      style: 'bg-gray-50 text-gray-300' };

                return (
                  <>
                    <tr
                      key={v.voteID}
                      onClick={() => toggleVote(v.voteID)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      {/* Date + Knesset */}
                      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap align-top">
                        {v.date
                          ? new Date(v.date).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' })
                          : '–'}
                        <p className="text-gray-300 mt-0.5">{lang === 'he' ? `כנסת ${v.knessetNum}` : `K${v.knessetNum}`}</p>
                      </td>

                      {/* Vote subject */}
                      <td className="py-3 px-4 align-top">
                        {v.billName
                          ? <p className="font-medium text-gray-900 leading-snug line-clamp-2" dir="rtl">{v.billName}</p>
                          : <p className="text-xs text-gray-400 italic">{lang === 'he' ? 'שם הנושא לא זמין' : 'Subject unavailable'}</p>
                        }
                        {v.voteAction && (
                          <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded" dir="rtl">
                            {v.voteAction}
                          </span>
                        )}
                      </td>

                      {/* Member's stance */}
                      <td className="py-3 px-4 align-top">
                        <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold ${stance.style}`}>
                          {stance.icon}
                          {lang === 'he' ? stance.he : stance.en}
                        </span>
                      </td>

                      {/* Vote result */}
                      <td className="py-3 px-4 align-top">
                        {v.isAccepted !== null && (
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold ${v.isAccepted ? 'text-green-700' : 'text-red-600'}`}>
                            {v.isAccepted ? <CheckCircle size={11} /> : <XCircle size={11} />}
                            {v.isAccepted ? (lang === 'he' ? 'עבר' : 'Passed') : (lang === 'he' ? 'נכשל' : 'Failed')}
                          </span>
                        )}
                        {(v.totalFor > 0 || v.totalAgainst > 0) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            <span className="text-green-600">{v.totalFor}✓</span>
                            {' '}
                            <span className="text-red-500">{v.totalAgainst}✗</span>
                            {v.totalAbstain > 0 && <span> {v.totalAbstain}~</span>}
                          </p>
                        )}
                      </td>

                      {/* Expand toggle */}
                      <td className="py-3 px-2 text-gray-400 align-top">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${v.voteID}-exp`} className="bg-blue-50">
                        <td colSpan={5} className="px-5 py-4 border-t border-blue-100">

                          {/* Header: full title + source link */}
                          <div className="flex items-start gap-2 mb-3">
                            <div className="flex-1">
                              {v.billName
                                ? <p className="font-semibold text-gray-900 leading-snug text-sm" dir="rtl">{v.billName}</p>
                                : <p className="text-xs text-gray-400 italic">{lang === 'he' ? 'שם הנושא לא זמין' : 'Subject unavailable'}</p>
                              }
                              {v.voteAction && (
                                <span className="inline-block mt-1 text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded" dir="rtl">
                                  {v.voteAction}
                                </span>
                              )}
                            </div>
                            <a
                              href={`https://main.knesset.gov.il/Activity/plenum/Votes/Pages/vote.aspx?voteId=${v.voteID}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-xs text-blue-600 hover:underline flex-shrink-0"
                            >
                              <ExternalLink size={12} />
                              {lang === 'he' ? 'אתר הכנסת' : 'Knesset site'}
                            </a>
                          </div>

                          {/* AI content */}
                          {summaryState === 'loading' ? (
                            <div className="flex items-center gap-2 text-gray-400 text-xs py-1">
                              <Loader2 size={13} className="animate-spin" />
                              {lang === 'he' ? 'טוען סיכום AI…' : 'Generating AI summary…'}
                            </div>
                          ) : summaryState === 'error' ? (
                            <p className="text-xs text-red-400">{lang === 'he' ? 'שגיאה בטעינת הסיכום' : 'Failed to load summary'}</p>
                          ) : summaryState ? (
                            <div className="space-y-2">
                              {summaryState.voteSummary && (
                                <p className="text-sm text-gray-700 leading-relaxed" dir="rtl">
                                  {summaryState.voteSummary}
                                </p>
                              )}
                              {summaryState.stanceNote && (
                                <div className="flex items-start gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100">
                                  <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${stance.style}`}>
                                    {stance.icon}
                                    {lang === 'he' ? stance.he : stance.en}
                                  </span>
                                  <p className="text-xs text-gray-600 leading-relaxed" dir="rtl">
                                    {summaryState.stanceNote}
                                  </p>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}

        {votes.length === 20 && (
          <p className="text-xs text-gray-400 py-3 text-center border-t border-gray-100">
            {lang === 'he' ? 'מוצגות 20 ההצבעות האחרונות' : 'Showing 20 most recent votes'}
          </p>
        )}
      </div>

      {/* ── News section ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mt-6">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <Newspaper size={16} className="text-blue-600" />
          <h2 className="font-bold text-gray-800">
            {lang === 'he' ? 'כתבות אחרונות' : 'Recent News'}
          </h2>
          {news.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
              {news.length}
            </span>
          )}
        </div>

        {newsLoading ? (
          <div className="flex items-center gap-2 text-gray-400 p-5">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">{lang === 'he' ? 'מחפש כתבות…' : 'Searching for articles…'}</span>
          </div>
        ) : news.length === 0 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            {lang === 'he' ? 'לא נמצאו כתבות.' : 'No articles found.'}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {news.map((article, i) => (
              <div key={i} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title + source */}
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-gray-900 text-sm hover:text-blue-700 leading-snug block mb-1"
                      dir="rtl"
                    >
                      {article.title}
                    </a>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                      {article.source && <span className="font-medium text-gray-500">{article.source}</span>}
                      {article.source && article.publishedAt && <span>·</span>}
                      {article.publishedAt && (
                        <span>
                          {new Date(article.publishedAt).toLocaleDateString(
                            lang === 'he' ? 'he-IL' : 'en-US',
                            { day: 'numeric', month: 'short', year: 'numeric' }
                          )}
                        </span>
                      )}
                    </div>

                    {/* AI summary */}
                    {article.aiSummary && (
                      <div className="flex items-start gap-1.5">
                        <Sparkles size={11} className="text-purple-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-600 leading-relaxed" dir="rtl">
                          {article.aiSummary}
                        </p>
                      </div>
                    )}
                  </div>

                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 text-gray-300 hover:text-blue-500 transition-colors mt-0.5"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-100">
          {lang === 'he'
            ? 'מקור: Google News · מסוכם ע"י AI · מתעדכן כל 12 שעות'
            : 'Source: Google News · AI-summarized · Refreshed every 12 hours'}
        </p>
      </div>
    </div>
  );
}
