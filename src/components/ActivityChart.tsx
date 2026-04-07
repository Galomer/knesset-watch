'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import type { QuarterPoint } from '@/app/api/activity/route';

interface FactionOption { id: number; name: string; nameEng: string; isCoalition: boolean }

interface Props { lang: 'en' | 'he' }

const KNESSET_OPTIONS = [
  { value: 'all', labelHe: 'כל הכנסות',  labelEn: 'All Knessets' },
  { value: '25',  labelHe: 'כנסת 25',     labelEn: 'K25 (2022–)' },
  { value: '24',  labelHe: 'כנסת 24',     labelEn: 'K24 (2021–22)' },
  { value: '23',  labelHe: 'כנסת 23',     labelEn: 'K23 (2020–21)' },
  { value: '22',  labelHe: 'כנסת 22',     labelEn: 'K22 (2019–20)' },
  { value: '21',  labelHe: 'כנסת 21',     labelEn: 'K21 (2019)' },
  { value: '20',  labelHe: 'כנסת 20',     labelEn: 'K20 (2015–19)' },
];

// Custom tooltip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((p: { dataKey: string; value: number; color: string }) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-600 capitalize">{p.dataKey}:</span>
          <span className="font-semibold text-gray-900">{p.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function ActivityChart({ lang }: Props) {
  const [data, setData] = useState<QuarterPoint[]>([]);
  const [factions, setFactions] = useState<FactionOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [knesset, setKnesset]   = useState('all');
  const [faction, setFaction]   = useState('');   // '' = all, 'coalition', 'opposition', or faction_id
  const [showFiled, setFiled]   = useState(true);
  const [showPassed, setPassed] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ knesset });
    if (faction === 'coalition')   params.set('side', 'coalition');
    else if (faction === 'opposition') params.set('side', 'opposition');
    else if (faction)              params.set('faction', faction);

    try {
      const res = await fetch(`/api/activity?${params}`);
      const d = await res.json();
      setData(d.quarters ?? []);
      if (d.factions?.length) setFactions(d.factions);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [knesset, faction]);

  useEffect(() => { load(); }, [load]);

  const isRTL = lang === 'he';
  const t = (he: string, en: string) => lang === 'he' ? he : en;

  const totalFiled  = data.reduce((s, d) => s + d.filed, 0);
  const totalPassed = data.reduce((s, d) => s + d.passed, 0);

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 mb-5">

        {/* Knesset / timeframe */}
        <div className="flex gap-1.5 flex-wrap">
          {KNESSET_OPTIONS.map(o => (
            <button
              key={o.value}
              onClick={() => setKnesset(o.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                knesset === o.value
                  ? 'bg-blue-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400'
              }`}
            >
              {lang === 'he' ? o.labelHe : o.labelEn}
            </button>
          ))}
        </div>

        {/* Party filter */}
        <select
          value={faction}
          onChange={e => setFaction(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-36"
          dir={isRTL ? 'rtl' : 'ltr'}
        >
          <option value="">{t('כל הסיעות', 'All parties')}</option>
          <option value="coalition">{t('קואליציה', 'Coalition')}</option>
          <option value="opposition">{t('אופוזיציה', 'Opposition')}</option>
          <optgroup label={t('סיעות', 'Parties')}>
            {factions.filter(f => f.isCoalition).map(f => (
              <option key={f.id} value={String(f.id)}>{lang === 'he' ? f.name : f.nameEng}</option>
            ))}
          </optgroup>
          <optgroup label={t('אופוזיציה', 'Opposition')}>
            {factions.filter(f => !f.isCoalition).map(f => (
              <option key={f.id} value={String(f.id)}>{lang === 'he' ? f.name : f.nameEng}</option>
            ))}
          </optgroup>
        </select>

        {/* Metric toggles */}
        <div className="flex gap-2 ms-auto">
          <button
            onClick={() => setFiled(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showFiled
                ? 'bg-blue-50 border-blue-300 text-blue-700'
                : 'bg-white border-gray-200 text-gray-400'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" />
            {t('הצ"ח פעילות', 'Active bills')}
          </button>
          <button
            onClick={() => setPassed(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              showPassed
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-white border-gray-200 text-gray-400'
            }`}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
            {t('חוקים שנחקקו', 'Laws enacted')}
          </button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && data.length > 0 && (
        <div className="flex gap-4 mb-4 text-xs text-gray-500">
          {showFiled && (
            <span>
              <span className="font-semibold text-blue-600">{totalFiled.toLocaleString()}</span>
              {' '}{t('הצ"ח פעילות', 'active bills')}
            </span>
          )}
          {showFiled && showPassed && <span className="text-gray-300">·</span>}
          {showPassed && (
            <span>
              <span className="font-semibold text-green-600">{totalPassed.toLocaleString()}</span>
              {' '}{t('חוקים שנחקקו', 'laws enacted')}
            </span>
          )}
          <span className="text-gray-300">·</span>
          <span>{data.length} {t('רבעונים', 'quarters')}</span>
        </div>
      )}

      {/* Chart */}
      <div className="h-72">
        {loading ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            <svg className="animate-spin mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            {t('טוען…', 'Loading…')}
          </div>
        ) : data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            {t('אין נתונים לתקופה זו', 'No data for this period')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 4, right: 20, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={32}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) =>
                  value === 'filed'
                    ? t('הצ"ח פעילות (לפי עדכון אחרון)', 'Active bills (by last update)')
                    : t('חוקים שנחקקו (לפי תאריך פרסום)', 'Laws enacted (by publication date)')
                }
                wrapperStyle={{ fontSize: 12 }}
              />
              {showFiled && (
                <Bar
                  dataKey="filed"
                  fill="#93c5fd"
                  radius={[3, 3, 0, 0]}
                  maxBarSize={28}
                />
              )}
              {showPassed && (
                <Line
                  type="monotone"
                  dataKey="passed"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#22c55e', strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <p className="text-xs text-gray-400 mt-2">
        {t(
          'עמודות כחולות: הצ"ח לפי תאריך עדכון אחרון בכנסת. קו ירוק: חוקים שנחקקו לפי תאריך פרסום בספר החוקים.',
          'Blue bars: bills by last Knesset update date. Green line: enacted laws by official gazette publication date.',
        )}
      </p>
    </div>
  );
}
