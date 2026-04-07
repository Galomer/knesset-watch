'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLang } from '@/lib/lang-context';
import { RefreshCw, ChevronDown, ChevronUp, Users, CheckSquare, FileText, BarChart3, HeartHandshake, TrendingUp } from 'lucide-react';
import ImpactGrid from '@/components/ImpactGrid';
import ActivityChart from '@/components/ActivityChart';
import type { ImpactData } from '@/app/api/impact/route';

interface PartyStats {
  FactionID: number;
  Name: string;
  NameEng: string;
  Seats: number;
  IsCoalition: boolean;
  Members: number[];
  BillsProposed: number;
  BillsPassed: number;
}

interface MemberName {
  PersonID: number;
  FullName: string;
  FullNameEng: string;
}

const PARTY_COLORS: Record<number, string> = {
  1096: '#1a56db', // Likud
  1102: '#0e9f6e', // Yesh Atid
  1095: '#ff8c00', // Shas
  1110: '#6b7280', // National Unity
  1098: '#6b7280',
  1105: '#dc2626', // Religious Zionism
  1106: '#b91c1c', // Otzma Yehudit
  1101: '#78350f', // UTJ
  1104: '#1d4ed8', // Yisrael Beytenu
  1103: '#065f46', // Hadash-Taal
  1099: '#047857', // Raam
  1100: '#e11d48', // Labor
  1107: '#7c3aed', // Noam
  1108: '#374151', // National Right
};

function getColor(factionID: number, isCoalition: boolean) {
  return PARTY_COLORS[factionID] ?? (isCoalition ? '#2563eb' : '#6b7280');
}

export default function AnalyticsPage() {
  const { lang } = useLang();
  const isRTL = lang === 'he';
  const [parties, setParties] = useState<PartyStats[]>([]);
  const [memberNames, setMemberNames] = useState<Map<number, MemberName>>(new Map());
  const [loading, setLoading] = useState(true);
  const [billsLoading, setBillsLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [metric, setMetric] = useState<'seats' | 'passed' | 'proposed'>('seats');
  const [groupFilter, setGroupFilter] = useState<'all' | 'coalition' | 'opposition'>('all');
  const [impactData, setImpactData]   = useState<ImpactData[]>([]);
  const [impactLoading, setImpactLoading] = useState(true);

  useEffect(() => {
    // Load party seats + member names in parallel (both cached)
    Promise.all([
      fetch('/api/parties').then(r => r.json()),
      fetch('/api/members').then(r => r.json()),
    ]).then(([partyData, memberData]: [PartyStats[], MemberName[]]) => {
        setParties(partyData);
        const nameMap = new Map<number, MemberName>();
        for (const m of memberData) nameMap.set(m.PersonID, m);
        setMemberNames(nameMap);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    // Load analytics (bills per party)
    fetch('/api/analytics')
      .then(r => r.json())
      .then((data: PartyStats[]) => {
        if (data.length > 0) setParties(data);
        setBillsLoading(false);
      })
      .catch(() => setBillsLoading(false));

    // Load population impact heatmap
    fetch('/api/impact?type=parties')
      .then(r => r.json())
      .then((data: ImpactData[]) => { setImpactData(data); setImpactLoading(false); })
      .catch(() => setImpactLoading(false));
  }, []);

  const tx = (he: string, en: string) => lang === 'he' ? he : en;

  const coalition = parties.filter(p => p.IsCoalition);
  const opposition = parties.filter(p => !p.IsCoalition);
  const totalSeats = parties.reduce((s, p) => s + p.Seats, 0) || 120;
  const coalitionSeats = coalition.reduce((s, p) => s + p.Seats, 0);

  const filteredParties = groupFilter === 'all' ? parties
    : groupFilter === 'coalition' ? parties.filter(p => p.IsCoalition)
    : parties.filter(p => !p.IsCoalition);

  const displayData = metric === 'seats'
    ? filteredParties.map(p => ({ ...p, value: p.Seats, max: totalSeats }))
    : metric === 'passed'
    ? filteredParties.map(p => ({ ...p, value: p.BillsPassed ?? 0, max: Math.max(...filteredParties.map(x => x.BillsPassed ?? 0)) || 1 }))
    : filteredParties.map(p => ({ ...p, value: p.BillsProposed ?? 0, max: Math.max(...filteredParties.map(x => x.BillsProposed ?? 0)) || 1 }));

  const sortedDisplay = [...displayData].sort((a, b) => b.value - a.value);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {tx('לוח אנליטיקה', 'Analytics Dashboard')}
        </h1>
        <p className="text-gray-500">
          {tx('כנסת ה-25 · השוואת סיעות', '25th Knesset · Party Comparison')}
        </p>
      </div>

      {/* ── SECTION 1: Parliament Composition ──────────────────────────── */}
      <section className="mb-10">
        <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Users size={20} className="text-blue-600" />
          {tx('הרכב הכנסת', 'Parliament Composition')}
        </h2>

        {/* Coalition vs Opposition summary cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-blue-600 text-white rounded-2xl p-5">
            <div className="text-4xl font-bold mb-1">{coalitionSeats}</div>
            <div className="text-blue-200 text-sm">{tx('מנדטים — קואליציה', 'Seats — Coalition')}</div>
            <div className="text-blue-300 text-xs mt-1">{coalition.length} {tx('סיעות', 'parties')}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              {coalition.map(p => (
                <span key={p.FactionID} className="text-xs bg-blue-500 px-2 py-0.5 rounded-full">
                  {lang === 'he' ? p.Name.split(' ')[0] : p.NameEng.split(' ')[0]} {p.Seats}
                </span>
              ))}
            </div>
          </div>
          <div className="bg-gray-700 text-white rounded-2xl p-5">
            <div className="text-4xl font-bold mb-1">{totalSeats - coalitionSeats}</div>
            <div className="text-gray-300 text-sm">{tx('מנדטים — אופוזיציה', 'Seats — Opposition')}</div>
            <div className="text-gray-400 text-xs mt-1">{opposition.length} {tx('סיעות', 'parties')}</div>
            <div className="mt-3 flex flex-wrap gap-1">
              {opposition.map(p => (
                <span key={p.FactionID} className="text-xs bg-gray-600 px-2 py-0.5 rounded-full">
                  {lang === 'he' ? p.Name.split(' ')[0] : p.NameEng.split(' ')[0]} {p.Seats}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Seat distribution bar */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex h-12 rounded-xl overflow-hidden gap-px mb-3">
            {parties.map(p => (
              <div
                key={p.FactionID}
                className="relative group cursor-pointer transition-opacity hover:opacity-80"
                style={{
                  width: `${(p.Seats / totalSeats) * 100}%`,
                  backgroundColor: getColor(p.FactionID, p.IsCoalition),
                  opacity: p.IsCoalition ? 1 : 0.6,
                }}
                title={`${lang === 'he' ? p.Name : p.NameEng}: ${p.Seats} ${tx('מנדטים', 'seats')}`}
              >
                {p.Seats >= 5 && (
                  <span className="absolute inset-0 flex items-center justify-center text-white text-xs font-bold">
                    {p.Seats}
                  </span>
                )}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {parties.map(p => (
              <span key={p.FactionID} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full inline-block"
                  style={{ backgroundColor: getColor(p.FactionID, p.IsCoalition), opacity: p.IsCoalition ? 1 : 0.6 }} />
                {lang === 'he' ? p.Name.split(' ')[0] : p.NameEng}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 2: Activity Chart ──────────────────────────────────── */}
      <section>
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-blue-600" />
            {tx('פעילות חקיקתית לאורך זמן', 'Legislative Activity Over Time')}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {tx('הצעות חוק וחוקים שעברו לפי רבעון', 'Bills filed and laws passed by quarter')}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8">
          <ActivityChart lang={lang} />
        </div>
      </section>

      {/* ── SECTION 3: Bill Comparison ──────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-600" />
            {tx('השוואת סיעות', 'Party Comparison')}
          </h2>

          {/* Coalition/Opposition filter */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {([
              ['all',        tx('הכל', 'All')],
              ['coalition',  tx('קואליציה', 'Coalition')],
              ['opposition', tx('אופוזיציה', 'Opposition')],
            ] as [string, string][]).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setGroupFilter(val as typeof groupFilter)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  groupFilter === val ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Metric toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1 gap-1">
            {([
              ['seats',    tx('מנדטים','Seats'),    <Users key="s" size={13}/>],
              ['passed',   tx('חוקים עברו','Laws Passed'), <CheckSquare key="p" size={13}/>],
              ['proposed', tx('הצ"ח','Bills Filed'),  <FileText key="b" size={13}/>],
            ] as [string, string, React.ReactNode][]).map(([val, label, icon]) => (
              <button
                key={val}
                onClick={() => setMetric(val as typeof metric)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  metric === val ? 'bg-white shadow text-blue-700' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {icon}{label}
              </button>
            ))}
          </div>
        </div>

        {/* Bills loading notice */}
        {billsLoading && metric !== 'seats' && (
          <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
            <RefreshCw size={14} className="animate-spin" />
            {tx('מחשב נתוני חוקים — עשוי לקחת כמה שניות…', 'Computing bill data — may take a few seconds…')}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
            <RefreshCw size={20} className="animate-spin" />
          </div>
        ) : (
          <div className="space-y-3">
            {sortedDisplay.map((party, rank) => {
              const barPct = party.max > 0 ? (party.value / party.max) * 100 : 0;
              const color = getColor(party.FactionID, party.IsCoalition);
              const isOpen = expanded === party.FactionID;
              const pName = lang === 'he' ? party.Name : party.NameEng;

              return (
                <div key={party.FactionID}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors">
                  <button
                    className="w-full text-left px-5 py-4"
                    onClick={() => setExpanded(isOpen ? null : party.FactionID)}
                  >
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <span className="text-lg font-bold text-gray-300 w-6 flex-shrink-0">
                        {rank + 1}
                      </span>

                      {/* Party name + badge */}
                      <div className="w-40 flex-shrink-0 min-w-0">
                        <div className="font-bold text-gray-900 text-sm truncate">{pName}</div>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                          party.IsCoalition ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {party.IsCoalition ? tx('קואליציה','Coalition') : tx('אופוזיציה','Opposition')}
                        </span>
                      </div>

                      {/* Bar */}
                      <div className="flex-1 flex items-center gap-3">
                        <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${barPct}%`, backgroundColor: color, opacity: party.IsCoalition ? 1 : 0.7 }}
                          />
                        </div>
                        <span className="text-xl font-bold text-gray-900 w-12 text-right flex-shrink-0">
                          {party.value}
                        </span>
                      </div>

                      {/* Context stats */}
                      <div className="hidden sm:flex gap-4 flex-shrink-0 text-xs text-gray-500">
                        <div className="text-center">
                          <div className="font-semibold text-gray-700">{party.Seats}</div>
                          <div>{tx('מנדטים','Seats')}</div>
                        </div>
                        {!billsLoading && (
                          <>
                            <div className="text-center">
                              <div className="font-semibold text-gray-700">{party.BillsPassed ?? '—'}</div>
                              <div>{tx('עברו','Passed')}</div>
                            </div>
                            <div className="text-center">
                              <div className="font-semibold text-gray-700">{party.BillsProposed ?? '—'}</div>
                              <div>{tx('הוגשו','Filed')}</div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Expand icon */}
                      {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                    </div>
                  </button>

                  {/* Drill-down: members */}
                  {isOpen && (
                    <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                      <p className="text-xs text-gray-500 font-medium mb-3">
                        {tx(`${party.Seats} חברי כנסת`, `${party.Seats} Members`)}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {(party.Members ?? []).map(pid => {
                          const m = memberNames.get(pid);
                          const displayName = m
                            ? (lang === 'he' ? m.FullName : (m.FullNameEng || m.FullName))
                            : `#${pid}`;
                          return (
                            <Link
                              key={pid}
                              href={`/member/${pid}`}
                              className="text-xs bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-700 px-2.5 py-1 rounded-full transition-colors"
                              onClick={e => e.stopPropagation()}
                            >
                              {displayName}
                            </Link>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400 mt-3">
                        {tx('לחץ על חבר כנסת לפרופיל המלא', 'Click a member to see their full profile')}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!billsLoading && !loading && (
          <p className="text-xs text-gray-400 text-center mt-4">
            {tx(
              'נתוני חוקים שעברו — כנסת 25 בלבד · מקור: API פתוח של הכנסת · מתעדכן כל שעה',
              'Bills passed data — 25th Knesset only · Source: Knesset Open Data API · Updated hourly'
            )}
          </p>
        )}
      </section>

      {/* ── SECTION 3: Population Impact Heatmap ───────────────────────────── */}
      <section className="mt-10">
        <h2 className="text-xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <HeartHandshake size={20} className="text-blue-600" />
          {tx('השפעה על אוכלוסיות', 'Impact on Population Groups')}
        </h2>
        <p className="text-gray-500 text-sm mb-5">
          {tx(
            'כיצד הצעות החוק של כל סיעה משפיעות על קבוצות שונות — לפי ניתוח AI של כל חוק',
            "How each party's bills affect different groups — based on AI classification of every bill"
          )}
        </p>

        {impactLoading ? (
          <div className="flex items-center gap-2 text-gray-400 py-8">
            <RefreshCw size={16} className="animate-spin" />
            {tx('טוען נתוני השפעה…', 'Loading impact data…')}
          </div>
        ) : impactData.length === 0 ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-700">
            {tx(
              'סיווג הצ"ח טרם הושלם. הפעל את scripts/classify.sh כדי לסווג את הצעות החוק.',
              'Bill classification not yet run. Execute scripts/classify.sh to classify bills first.'
            )}
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <ImpactGrid data={impactData} lang={lang} />
          </div>
        )}
      </section>
    </div>
  );
}
