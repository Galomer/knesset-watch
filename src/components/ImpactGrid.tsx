'use client';

import { GROUPS, GROUP_LABEL, type Group } from '@/lib/classifications';
import type { ImpactData } from '@/app/api/impact/route';

interface Props {
  data: ImpactData[];
  lang: 'en' | 'he';
  singleRow?: boolean;
}

// Color by direction: (pro-anti)/(pro+anti). Works correctly even with small counts.
function scoreToColor(scorePct: number): string {
  if (scorePct >= 60) return 'bg-green-600 text-white';
  if (scorePct >= 20) return 'bg-green-200 text-green-900';
  if (scorePct > -20) return 'bg-gray-100 text-gray-500';
  if (scorePct > -60) return 'bg-red-200 text-red-900';
  return 'bg-red-600 text-white';
}

export default function ImpactGrid({ data, lang, singleRow = false }: Props) {
  if (data.length === 0) return null;

  const isRTL = lang === 'he';
  const gl = (g: Group) => lang === 'he' ? GROUP_LABEL[g].he : GROUP_LABEL[g].en;

  // ── Single-row (member) view ──────────────────────────────────────────────
  if (singleRow) {
    const row = data[0];
    const sorted = [...GROUPS].sort((a, b) =>
      Math.abs(row.groups[b].score) - Math.abs(row.groups[a].score)
    );

    return (
      <div dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="grid grid-cols-4 gap-2 mb-5">
          {[
            { key: 'positive', label: lang === 'he' ? 'חיובי לכיס' : 'Pro-wallet',  color: 'bg-green-50 border-green-200 text-green-700', val: row.financial.positive },
            { key: 'negative', label: lang === 'he' ? 'שלילי לכיס' : 'Anti-wallet', color: 'bg-red-50 border-red-200 text-red-700',     val: row.financial.negative },
            { key: 'neutral',  label: lang === 'he' ? 'ניטרלי'     : 'Neutral',     color: 'bg-gray-50 border-gray-200 text-gray-600',   val: row.financial.neutral },
            { key: 'unknown',  label: lang === 'he' ? 'לא ברור'    : 'Unclear',     color: 'bg-gray-50 border-gray-200 text-gray-400',   val: row.financial.unknown },
          ].map(f => (
            <div key={f.key} className={`rounded-xl border p-3 text-center ${f.color}`}>
              <div className="text-xl font-bold">{f.val}</div>
              <div className="text-xs mt-0.5">{f.label}</div>
            </div>
          ))}
        </div>

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
                  <div className="h-full bg-red-400 transition-all"   style={{ width: `${barAnti}%` }} />
                </div>
                <div className="flex gap-2 text-xs w-32 flex-shrink-0">
                  {pro  > 0 && <span className="text-green-700 font-medium">▲{pro}</span>}
                  {anti > 0 && <span className="text-red-700 font-medium">▼{anti}</span>}
                  {neutral > 0 && <span className="text-gray-400">{neutral} –</span>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${scoreToColor(scorePct)}`}>
                  {scoreToLabel(scorePct, pro, anti, lang)}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 mt-3">
          {row.classifiedBills} {lang === 'he' ? 'הצעות חוק מסווגות מתוך' : 'classified bills of'} {row.totalBills} {lang === 'he' ? 'בסה"כ' : 'total'}
        </p>
      </div>
    );
  }

  // ── Party heatmap (matrix view) ───────────────────────────────────────────
  const coalition  = data.filter(p => p.isCoalition);
  const opposition = data.filter(p => !p.isCoalition);
  const ordered = [...coalition, ...opposition];

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
          <thead>
            <tr className="bg-gray-50">
              <th className="text-start py-3 px-4 font-semibold text-gray-700 w-44 sticky start-0 bg-gray-50 z-10 border-b border-gray-200">
                {lang === 'he' ? 'סיעה' : 'Party'}
              </th>
              <th className="py-3 px-2 font-medium text-gray-500 text-center border-b border-gray-200 whitespace-nowrap w-16">
                {lang === 'he' ? 'מסווג' : 'Bills'}
              </th>
              {GROUPS.map(g => (
                <th key={g} className="py-3 px-1 font-medium text-gray-600 text-center border-b border-gray-200 whitespace-nowrap" style={{ minWidth: 64 }}>
                  {gl(g)}
                </th>
              ))}
              <th className="py-3 px-2 font-medium text-gray-500 text-center border-b border-gray-200 whitespace-nowrap">
                {lang === 'he' ? 'כלכלה' : 'Econ'}
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((party, idx) => {
              const isFirstOpposition = !party.isCoalition && (idx === 0 || ordered[idx - 1].isCoalition);
              const pName = lang === 'he' ? party.name : party.nameEng;

              return (
                <>
                  {isFirstOpposition && (
                    <tr key="sep-opp">
                      <td colSpan={GROUPS.length + 3} className="px-4 py-1.5 bg-gray-100 text-gray-500 text-xs font-semibold border-y border-gray-200">
                        {lang === 'he' ? '— אופוזיציה —' : '— Opposition —'}
                      </td>
                    </tr>
                  )}
                  {idx === 0 && coalition.length > 0 && (
                    <tr key="sep-coal">
                      <td colSpan={GROUPS.length + 3} className="px-4 py-1.5 bg-blue-50 text-blue-600 text-xs font-semibold border-y border-blue-100">
                        {lang === 'he' ? '— קואליציה —' : '— Coalition —'}
                      </td>
                    </tr>
                  )}
                  <tr key={party.id} className="border-b border-gray-100 hover:bg-blue-50/30 transition-colors">
                    {/* Party name — sticky, always visible */}
                    <td className="py-3 px-4 sticky start-0 bg-white hover:bg-blue-50/30 z-10 border-e border-gray-100">
                      <div className="font-bold text-gray-900 text-sm leading-tight">{pName}</div>
                      <div className={`text-xs mt-0.5 font-medium ${party.isCoalition ? 'text-blue-500' : 'text-gray-400'}`}>
                        {party.isCoalition ? (lang === 'he' ? 'קואליציה' : 'Coalition') : (lang === 'he' ? 'אופוזיציה' : 'Opposition')}
                      </div>
                    </td>

                    {/* Bill count */}
                    <td className="py-3 px-2 text-center border-e border-gray-100">
                      <div className="font-bold text-gray-700">{party.classifiedBills}</div>
                      <div className="text-gray-400 text-xs">/{party.totalBills}</div>
                    </td>

                    {/* Group stances */}
                    {GROUPS.map(g => {
                      const { pro, anti, scorePct } = party.groups[g];
                      const hasData = pro > 0 || anti > 0;
                      return (
                        <td key={g} className="py-2 px-1 text-center">
                          <div
                            className={`inline-flex flex-col items-center justify-center w-14 h-10 rounded-lg text-xs font-semibold cursor-default transition-colors ${
                              hasData ? scoreToColor(scorePct) : 'bg-gray-50 text-gray-300'
                            }`}
                            title={`${pName} – ${gl(g)}: ▲${pro} בעד / ▼${anti} נגד מתוך ${party.classifiedBills} מסווגים`}
                          >
                            {hasData ? (
                              <>
                                <span className="text-xs leading-none">▲{pro} ▼{anti}</span>
                                <span className="text-xs opacity-60 font-normal leading-none mt-0.5">
                                  {scorePct > 0 ? '+' : ''}{scorePct}%
                                </span>
                              </>
                            ) : '–'}
                          </div>
                        </td>
                      );
                    })}

                    {/* Economic net */}
                    <td className="py-2 px-2 text-center">
                      {(() => {
                        const { positive, negative } = party.financial;
                        const net = positive - negative;
                        const total = party.classifiedBills || 1;
                        const pct = Math.round((net / total) * 100);
                        const hasData = positive > 0 || negative > 0;
                        return (
                          <div
                            className={`inline-flex flex-col items-center justify-center w-14 h-10 rounded-lg text-xs font-semibold ${
                              hasData ? scoreToColor(pct) : 'bg-gray-50 text-gray-300'
                            }`}
                            title={`+${positive} חיובי / -${negative} שלילי`}
                          >
                            {hasData ? (
                              <>
                                <span>{pct > 0 ? '+' : ''}{pct}%</span>
                                <span className="text-xs opacity-70 font-normal">+{positive} -{negative}</span>
                              </>
                            ) : '–'}
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
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-5 text-xs text-gray-500 flex-wrap">
        <span className="font-semibold text-gray-600">{lang === 'he' ? 'מקרא:' : 'Legend:'}</span>
        {[
          { color: 'bg-green-600', label: lang === 'he' ? 'בעד חזק' : 'Strong pro' },
          { color: 'bg-green-200', label: lang === 'he' ? 'נוטה לטובה' : 'Lean pro' },
          { color: 'bg-gray-100',  label: lang === 'he' ? 'ניטרלי / אין נתון' : 'Neutral / no data' },
          { color: 'bg-red-200',   label: lang === 'he' ? 'נוטה נגד' : 'Lean anti' },
          { color: 'bg-red-600',   label: lang === 'he' ? 'נגד חזק' : 'Strong anti' },
        ].map(l => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={`w-3.5 h-3.5 rounded ${l.color} inline-block flex-shrink-0`} />
            {l.label}
          </span>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">
        {lang === 'he'
          ? 'כל תא: ▲בעד ▼נגד (מספר הצ"ח) · % = כיוון העמדה. רק הצ"ח שסווגו על ידי AI נכללות.'
          : 'Each cell: ▲pro ▼anti (bill count) · % = stance direction. AI-classified bills only.'}
      </p>
    </div>
  );
}
