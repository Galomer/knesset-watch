'use client';

import { GROUPS, GROUP_LABEL, type Group } from '@/lib/classifications';
import type { ImpactData } from '@/app/api/impact/route';

interface Props {
  data: ImpactData[];
  lang: 'en' | 'he';
  /** If true, show a single row (member view). If false, show full matrix (party view). */
  singleRow?: boolean;
}

function scoreToColor(scorePct: number, total: number): string {
  if (total === 0) return 'bg-gray-100 text-gray-300';
  if (scorePct >=  60) return 'bg-green-600 text-white';
  if (scorePct >=  25) return 'bg-green-200 text-green-900';
  if (scorePct >=  -24) return 'bg-gray-100 text-gray-500';
  if (scorePct >= -59) return 'bg-red-200 text-red-900';
  return 'bg-red-600 text-white';
}

function scoreToLabel(scorePct: number, total: number, lang: 'en' | 'he'): string {
  if (total === 0) return '–';
  if (scorePct >= 60)   return lang === 'he' ? 'בעד' : 'Pro';
  if (scorePct >= 25)   return lang === 'he' ? 'נוטה' : 'Lean';
  if (scorePct >= -24)  return lang === 'he' ? 'מעורב' : 'Mixed';
  if (scorePct >= -59)  return lang === 'he' ? 'נגד' : 'Lean';
  return lang === 'he' ? 'נגד' : 'Anti';
}

export default function ImpactGrid({ data, lang, singleRow = false }: Props) {
  if (data.length === 0) return null;

  const isRTL = lang === 'he';
  const gl = (g: Group) => lang === 'he' ? GROUP_LABEL[g].he : GROUP_LABEL[g].en;

  // For single-row (member) view, show all groups with scores sorted by magnitude
  if (singleRow) {
    const row = data[0];
    const sorted = [...GROUPS].sort((a, b) =>
      Math.abs(row.groups[b].score) - Math.abs(row.groups[a].score)
    );

    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        {/* Financial impact summary */}
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { key: 'positive', label: lang === 'he' ? 'חיובי לכיס' : 'Pro-wallet', color: 'bg-green-50 border-green-200 text-green-700', val: row.financial.positive },
            { key: 'negative', label: lang === 'he' ? 'שלילי לכיס' : 'Anti-wallet', color: 'bg-red-50 border-red-200 text-red-700', val: row.financial.negative },
            { key: 'neutral',  label: lang === 'he' ? 'ניטרלי' : 'Neutral', color: 'bg-gray-50 border-gray-200 text-gray-600', val: row.financial.neutral },
            { key: 'unknown', label: lang === 'he' ? 'לא ברור' : 'Unclear', color: 'bg-gray-50 border-gray-200 text-gray-400', val: row.financial.unknown },
          ].map(f => (
            <div key={f.key} className={`rounded-xl border p-3 text-center ${f.color}`}>
              <div className="text-xl font-bold">{f.val}</div>
              <div className="text-xs mt-0.5">{f.label}</div>
            </div>
          ))}
        </div>

        {/* Group impact list */}
        <div className="space-y-2">
          {sorted.map(g => {
            const { pro, anti, neutral, scorePct } = row.groups[g];
            const total = pro + anti;
            if (total === 0) return null;
            const barPro  = total > 0 ? (pro  / total) * 100 : 50;
            const barAnti = total > 0 ? (anti / total) * 100 : 50;

            return (
              <div key={g} className="flex items-center gap-3">
                <span className="text-xs font-medium text-gray-700 w-28 flex-shrink-0">{gl(g)}</span>
                <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-green-500 transition-all" style={{ width: `${barPro}%` }} />
                  <div className="h-full bg-red-400 transition-all" style={{ width: `${barAnti}%` }} />
                </div>
                <div className="flex gap-2 text-xs w-32 flex-shrink-0">
                  {pro  > 0 && <span className="text-green-700 font-medium">▲{pro}</span>}
                  {anti > 0 && <span className="text-red-700 font-medium">▼{anti}</span>}
                  {neutral > 0 && <span className="text-gray-400">{neutral} –</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${scoreToColor(scorePct, total)}`}>
                  {scoreToLabel(scorePct, total, lang)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          {row.classifiedBills} {lang === 'he' ? 'הצ"ח מסווגות מתוך' : 'classified bills of'} {row.totalBills} {lang === 'he' ? 'בסה"כ' : 'total'}
        </p>
      </div>
    );
  }

  // ── Party heatmap (matrix view) ───────────────────────────────────────────
  const coalition  = data.filter(p => p.isCoalition);
  const opposition = data.filter(p => !p.isCoalition);
  const ordered = [...coalition, ...opposition];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="overflow-x-auto">
      <table className="w-full text-xs border-collapse min-w-[700px]">
        <thead>
          <tr>
            <th className="text-left py-2 px-3 font-semibold text-gray-600 min-w-[130px] sticky left-0 bg-white z-10">
              {lang === 'he' ? 'סיעה' : 'Party'}
            </th>
            {GROUPS.map(g => (
              <th key={g} className="py-2 px-1 font-medium text-gray-500 text-center whitespace-nowrap">
                {gl(g)}
              </th>
            ))}
            <th className="py-2 px-2 font-medium text-gray-500 text-center">
              {lang === 'he' ? 'כלכלה' : 'Econ'}
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Coalition separator */}
          {coalition.length > 0 && (
            <tr>
              <td colSpan={GROUPS.length + 2} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-xs font-semibold">
                {lang === 'he' ? '— קואליציה —' : '— Coalition —'}
              </td>
            </tr>
          )}
          {ordered.map((party, idx) => {
            // Insert opposition separator
            const isFirstOpposition = !party.isCoalition && (idx === 0 || ordered[idx - 1].isCoalition);
            return (
              <>
                {isFirstOpposition && (
                  <tr key={`sep-opp`}>
                    <td colSpan={GROUPS.length + 2} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold">
                      {lang === 'he' ? '— אופוזיציה —' : '— Opposition —'}
                    </td>
                  </tr>
                )}
                <tr key={party.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="py-2 px-3 font-semibold text-gray-800 sticky left-0 bg-white hover:bg-gray-50 whitespace-nowrap">
                    <div>{lang === 'he' ? party.name : party.nameEng}</div>
                    <div className="text-gray-400 font-normal">{party.classifiedBills} {lang === 'he' ? 'מסווגות' : 'classified'}</div>
                  </td>
                  {GROUPS.map(g => {
                    const { pro, anti, scorePct } = party.groups[g];
                    const total = pro + anti;
                    return (
                      <td key={g} className="py-1.5 px-1 text-center">
                        <div
                          className={`inline-flex items-center justify-center w-12 h-7 rounded-lg text-xs font-medium cursor-default ${scoreToColor(scorePct, total)}`}
                          title={`${lang === 'he' ? party.name : party.nameEng} – ${gl(g)}: ▲${pro} ▼${anti}`}
                        >
                          {total === 0 ? '–' : `${scorePct > 0 ? '+' : ''}${scorePct}%`}
                        </div>
                      </td>
                    );
                  })}
                  {/* Financial net */}
                  <td className="py-1.5 px-2 text-center">
                    {(() => {
                      const { positive, negative } = party.financial;
                      const net = positive - negative;
                      const total = positive + negative;
                      const pct = total > 0 ? Math.round((net / total) * 100) : 0;
                      return (
                        <div className={`inline-flex items-center justify-center w-12 h-7 rounded-lg text-xs font-medium ${scoreToColor(pct, total)}`}
                          title={`+${positive} / -${negative}`}>
                          {total === 0 ? '–' : `${pct > 0 ? '+' : ''}${pct}%`}
                        </div>
                      );
                    })()}
                  </td>
                </tr>
              </>
            );
          })}
        </tbody>
      </table>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 text-xs text-gray-500 flex-wrap">
        <span className="font-medium">{lang === 'he' ? 'מקרא:' : 'Legend:'}</span>
        {[
          { color: 'bg-green-600', label: lang === 'he' ? 'בעד (>60%)' : 'Pro (>60%)' },
          { color: 'bg-green-200', label: lang === 'he' ? 'נוטה לטובה' : 'Lean pro' },
          { color: 'bg-gray-100',  label: lang === 'he' ? 'מעורב / ניטרלי' : 'Mixed / neutral' },
          { color: 'bg-red-200',   label: lang === 'he' ? 'נוטה נגד' : 'Lean anti' },
          { color: 'bg-red-600',   label: lang === 'he' ? 'נגד (>60%)' : 'Anti (>60%)' },
          { color: 'bg-gray-100 border border-gray-200', label: '–  ' + (lang === 'he' ? 'אין נתון' : 'no data yet') },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1">
            <span className={`w-4 h-4 rounded ${l.color} inline-block`} />
            {l.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {lang === 'he'
          ? '% = (בעד − נגד) / (בעד + נגד). רק חוקים שסווגו על ידי AI נכללים.'
          : '% = (pro − anti) / (pro + anti). Only AI-classified bills are included.'}
      </p>
    </div>
  );
}
