'use client';

import { useEffect, useState, useRef } from 'react';
import { useLang } from '@/lib/lang-context';
import { RefreshCw, Users, HeartHandshake, TrendingUp } from 'lucide-react';
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

// ── SVG Donut Chart ─────────────────────────────────────────────────────────
const SIZE = 280;
const CX = SIZE / 2;
const CY = SIZE / 2;
const R_OUTER = 120;
const R_INNER = 70;

function polarToCartesian(cx: number, cy: number, r: number, deg: number) {
  const rad = ((deg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end   = polarToCartesian(cx, cy, r, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 0 ${end.x} ${end.y}`;
}

function donutSlicePath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number) {
  const o1 = polarToCartesian(cx, cy, rOuter, startDeg);
  const o2 = polarToCartesian(cx, cy, rOuter, endDeg);
  const i1 = polarToCartesian(cx, cy, rInner, endDeg);
  const i2 = polarToCartesian(cx, cy, rInner, startDeg);
  const large = endDeg - startDeg > 180 ? 1 : 0;
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${i2.x} ${i2.y}`,
    'Z',
  ].join(' ');
}

interface TooltipState {
  x: number; y: number;
  name: string; seats: number; pct: string;
  isCoalition: boolean;
}

function DonutChart({ parties, totalSeats, lang }: { parties: PartyStats[]; totalSeats: number; lang: string }) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const tx = (he: string, en: string) => lang === 'he' ? he : en;

  let cursor = 0;
  const slices = parties.map(p => {
    const deg = (p.Seats / totalSeats) * 360;
    const start = cursor;
    const end = cursor + deg;
    cursor = end;
    return { ...p, start, end, deg };
  });

  const handleEnter = (e: React.MouseEvent, p: typeof slices[0]) => {
    const rect = svgRef.current!.getBoundingClientRect();
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      name: lang === 'he' ? p.Name : p.NameEng,
      seats: p.Seats,
      pct: ((p.Seats / totalSeats) * 100).toFixed(1),
      isCoalition: p.IsCoalition,
    });
  };

  const handleMove = (e: React.MouseEvent) => {
    if (!tooltip || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltip(t => t ? { ...t, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg ref={svgRef} width={SIZE} height={SIZE} onMouseLeave={() => setTooltip(null)} onMouseMove={handleMove}>
          {slices.map(p => (
            <path
              key={p.FactionID}
              d={donutSlicePath(CX, CY, R_OUTER, R_INNER, p.start, p.end)}
              fill={getColor(p.FactionID, p.IsCoalition)}
              opacity={p.IsCoalition ? 1 : 0.65}
              stroke="white"
              strokeWidth={1.5}
              className="cursor-pointer transition-opacity hover:opacity-90"
              onMouseEnter={e => handleEnter(e, p)}
            />
          ))}
          {/* Center label */}
          <text x={CX} y={CY - 10} textAnchor="middle" className="fill-gray-800" fontSize={28} fontWeight={700}>
            {totalSeats}
          </text>
          <text x={CX} y={CY + 14} textAnchor="middle" className="fill-gray-500" fontSize={12}>
            {tx('מנדטים', 'seats')}
          </text>
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="pointer-events-none absolute z-10 bg-gray-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap"
            style={{ left: tooltip.x + 12, top: tooltip.y - 10 }}
          >
            <div className="font-bold">{tooltip.name}</div>
            <div>{tooltip.seats} {tx('מנדטים', 'seats')} · {tooltip.pct}%</div>
            <div className="text-gray-400">{tooltip.isCoalition ? tx('קואליציה', 'Coalition') : tx('אופוזיציה', 'Opposition')}</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 mt-4 text-xs text-gray-600 max-w-sm">
        {parties.map(p => (
          <span key={p.FactionID} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: getColor(p.FactionID, p.IsCoalition), opacity: p.IsCoalition ? 1 : 0.65 }}
            />
            {lang === 'he' ? p.Name.split(' ')[0] : p.NameEng.split(' ')[0]}
            <span className="text-gray-400">{((p.Seats / (parties.reduce((s, x) => s + x.Seats, 0) || 120)) * 100).toFixed(0)}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { lang } = useLang();
  const isRTL = lang === 'he';
  const [parties, setParties] = useState<PartyStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [impactData, setImpactData] = useState<ImpactData[]>([]);
  const [impactLoading, setImpactLoading] = useState(true);

  useEffect(() => {
    fetch('/api/parties')
      .then(r => r.json())
      .then((data: PartyStats[]) => { setParties(data); setLoading(false); })
      .catch(() => setLoading(false));

    fetch('/api/analytics')
      .then(r => r.json())
      .then((data: PartyStats[]) => { if (data.length > 0) setParties(data); })
      .catch(() => {});

    fetch('/api/impact?type=parties')
      .then(r => r.json())
      .then((data: ImpactData[]) => { setImpactData(data); setImpactLoading(false); })
      .catch(() => setImpactLoading(false));
  }, []);

  const tx = (he: string, en: string) => lang === 'he' ? he : en;

  const coalition  = parties.filter(p => p.IsCoalition);
  const opposition = parties.filter(p => !p.IsCoalition);
  const totalSeats = parties.reduce((s, p) => s + p.Seats, 0) || 120;
  const coalitionSeats = coalition.reduce((s, p) => s + p.Seats, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {tx('לוח אנליטיקה', 'Analytics Dashboard')}
        </h1>
        <p className="text-gray-500">
          {tx('כנסת ה-25 · הרכב הכנסת ופעילות חקיקתית', '25th Knesset · Composition & Legislative Activity')}
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

        {/* Donut chart */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex justify-center">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400 py-20">
              <RefreshCw size={18} className="animate-spin" />
            </div>
          ) : (
            <DonutChart parties={parties} totalSeats={totalSeats} lang={lang} />
          )}
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
              'סיווג הצעות חוק טרם הושלם. הפעל את scripts/classify.sh כדי לסווג את הצעות החוק.',
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
