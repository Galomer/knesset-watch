'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLang } from '@/lib/lang-context';
import { t } from '@/lib/translations';
import { RealBill } from '@/lib/knesset-api';
import { GROUPS, GROUP_LABEL, STANCE_COLOR, FINANCIAL_COLOR, type Group, type Stance, type FinancialImpact, type BillClassification } from '@/lib/classifications';
import { Search, CheckCircle, Clock, XCircle, FileText, RefreshCw, ChevronLeft, ChevronRight, SlidersHorizontal, X, ChevronDown, ChevronUp, ExternalLink, Loader2 } from 'lucide-react';

interface Initiator { name: string; nameEng: string; faction: string }

interface BillSummaryData {
  billID: number;
  name: string;
  fullSummary: string;
  benefitsSummary: string;
  concernsSummary: string;
  initiators: { name: string; nameEng: string; faction: string; isInitiator: boolean }[];
  fromDB: boolean;
}

interface BillWithClassification extends RealBill {
  Classification: BillClassification | null;
  Initiators: Initiator[];
  StatusCategory: 'passed' | 'active' | 'stopped';
  StatusDescEn: string;
}

interface BillsResponse {
  bills: BillWithClassification[];
  total: number;
  page: number;
  pageSize: number;
}

interface StatusCounts { passed: number; stopped: number; pending: number }

const KNESSETS = [25, 24, 23, 22, 21, 20];
const PAGE_SIZE = 50;

export default function BillsPage() {
  const { lang } = useLang();
  const tx = (key: string) => t[key]?.[lang] ?? key;
  const isRTL = lang === 'he';

  const [knesset, setKnesset]           = useState(25);
  const [status, setStatus]             = useState('');
  const [type, setType]                 = useState('');
  const [group, setGroup]               = useState<Group | ''>('');
  const [stance, setStance]             = useState<'pro' | 'anti'>('pro');
  const [search, setSearch]             = useState('');
  const [debouncedSearch, setDebounced] = useState('');
  const [page, setPage]                 = useState(0);
  const [result, setResult]             = useState<BillsResponse | null>(null);
  const [counts, setCounts]             = useState<StatusCounts | null>(null);
  const [loading, setLoading]           = useState(true);
  const [showGroupFilter, setShowGroup] = useState(false);
  const [expanded, setExpanded]         = useState<number | null>(null);
  const [billSummaries, setBillSummaries] = useState<Map<number, BillSummaryData | 'loading' | 'error'>>(new Map());

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { setPage(0); }, [knesset, status, type, group, stance, debouncedSearch]);

  // Fetch status counts when knesset changes
  useEffect(() => {
    setCounts(null);
    fetch(`/api/bills?knesset=${knesset}&counts=1`)
      .then(r => r.json())
      .then(setCounts)
      .catch(() => {});
  }, [knesset]);

  const load = useCallback(async () => {
    setLoading(true);
    setExpanded(null);
    const params = new URLSearchParams({ knesset: String(knesset), page: String(page), limit: String(PAGE_SIZE) });
    if (status)          params.set('status', status);
    if (type)            params.set('type', type);
    if (group)           params.set('group', group);
    if (group)           params.set('stance', stance);
    if (debouncedSearch) params.set('search', debouncedSearch);

    try {
      const res = await fetch(`/api/bills?${params}`);
      setResult(await res.json());
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [knesset, status, type, group, stance, debouncedSearch, page]);

  useEffect(() => { load(); }, [load]);

  const bills      = result?.bills ?? [];
  const total      = result?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  function toggleExpand(billID: number) {
    if (expanded === billID) {
      setExpanded(null);
      return;
    }
    setExpanded(billID);
    if (!billSummaries.has(billID)) {
      setBillSummaries(prev => new Map(prev).set(billID, 'loading'));
      fetch(`/api/bill-summary?billID=${billID}`)
        .then(r => r.json())
        .then(data => setBillSummaries(prev => new Map(prev).set(billID, data)))
        .catch(() => setBillSummaries(prev => new Map(prev).set(billID, 'error')));
    }
  }

  const groupLabel = (g: Group) => lang === 'he' ? GROUP_LABEL[g].he : GROUP_LABEL[g].en;

  const categoryColor = (cat: string) =>
    cat === 'passed'  ? 'bg-green-100 text-green-800' :
    cat === 'stopped' ? 'bg-red-100 text-red-800' :
    'bg-yellow-100 text-yellow-800';

  const categoryIcon = (cat: string) =>
    cat === 'passed'  ? <CheckCircle size={11} /> :
    cat === 'stopped' ? <XCircle size={11} /> :
    <Clock size={11} />;

  return (
    <div className="max-w-7xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{tx('bills')}</h1>
          <p className="text-gray-500 mt-1">
            {lang === 'he'
              ? `כנסת ${knesset} · ${total.toLocaleString()} רשומות`
              : `Knesset ${knesset} · ${total.toLocaleString()} records`}
          </p>
        </div>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full mt-1">
          {lang === 'he' ? 'מסד נתונים' : 'Database'}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        {[
          { label: lang === 'he' ? 'סה"כ' : 'Total',   value: (counts ? counts.passed + counts.stopped + counts.pending : null)?.toLocaleString() ?? '…', icon: <FileText size={16} className="text-blue-600" />, filter: '' },
          { label: tx('billPassed'),  value: counts?.passed.toLocaleString()  ?? '…', icon: <CheckCircle size={16} className="text-green-600" />, filter: 'passed' },
          { label: tx('billPending'), value: counts?.pending.toLocaleString() ?? '…', icon: <Clock size={16} className="text-yellow-600" />, filter: 'pending' },
          { label: tx('billRejected') ?? 'Stopped', value: counts?.stopped.toLocaleString() ?? '…', icon: <XCircle size={16} className="text-red-600" />, filter: 'stopped' },
        ].map((s, i) => (
          <button key={i} onClick={() => setStatus(s.filter)}
            className={`bg-white rounded-xl border p-3 flex items-center gap-3 transition-all text-left hover:border-blue-300 ${
              status === s.filter ? 'border-blue-400 ring-1 ring-blue-300' : 'border-gray-200'
            }`}>
            {s.icon}
            <div>
              <div className="text-lg font-bold text-gray-900">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Knesset selector */}
      <div className="flex gap-2 flex-wrap mb-4">
        {KNESSETS.map(k => (
          <button key={k} onClick={() => setKnesset(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              knesset === k ? 'bg-blue-700 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-blue-400'
            }`}>
            {lang === 'he' ? `כנסת ${k}` : `K${k}`}
            {k === 25 && <span className="ml-1 text-xs opacity-60">{lang === 'he' ? '(נוכחית)' : '(current)'}</span>}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'he' ? 'חיפוש חוקים…' : 'Search bills…'}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            dir="rtl" />
        </div>

        {/* Type */}
        {([['', lang === 'he' ? 'סוג' : 'Type'], ['government', lang === 'he' ? 'ממשלתית' : 'Gov.'], ['private', lang === 'he' ? 'פרטית' : 'Private']] as [string,string][]).map(([val, label]) => (
          <button key={val} onClick={() => setType(val)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${type === val ? 'bg-purple-700 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:border-purple-400'}`}>
            {label}
          </button>
        ))}

        {/* Group filter */}
        <button onClick={() => setShowGroup(v => !v)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            group ? 'bg-orange-600 text-white' : showGroupFilter ? 'bg-orange-50 border border-orange-300 text-orange-700' : 'bg-white border border-gray-200 text-gray-700 hover:border-orange-400'
          }`}>
          <SlidersHorizontal size={13} />
          {group ? `${groupLabel(group as Group)} · ${stance === 'pro' ? (lang === 'he' ? 'בעד' : 'Pro') : (lang === 'he' ? 'נגד' : 'Anti')}` : (lang === 'he' ? 'קבוצה' : 'Group')}
        </button>
      </div>

      {/* Group filter panel */}
      {showGroupFilter && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-orange-800">
              {lang === 'he' ? 'סינון לפי קבוצת אוכלוסייה' : 'Filter by population group'}
            </p>
            {group && (
              <button onClick={() => { setGroup(''); setShowGroup(false); }}
                className="text-xs text-orange-600 hover:text-orange-900 flex items-center gap-1">
                <X size={12} /> {lang === 'he' ? 'נקה' : 'Clear'}
              </button>
            )}
          </div>
          <div className="flex gap-2 mb-3">
            <span className="text-xs text-orange-700 self-center font-medium">{lang === 'he' ? 'הצג חוקים:' : 'Show bills:'}</span>
            {(['pro', 'anti'] as const).map(s => (
              <button key={s} onClick={() => setStance(s)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  stance === s ? s === 'pro' ? 'bg-green-600 text-white' : 'bg-red-600 text-white' : 'bg-white border border-gray-200 text-gray-600'
                }`}>
                {s === 'pro' ? (lang === 'he' ? 'בעד הקבוצה' : 'Pro group') : (lang === 'he' ? 'נגד הקבוצה' : 'Anti group')}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {GROUPS.map(g => (
              <button key={g} onClick={() => setGroup(group === g ? '' : g)}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                  group === g ? stance === 'pro' ? 'bg-green-600 text-white' : 'bg-red-600 text-white' : 'bg-white border border-orange-200 text-gray-700 hover:border-orange-500'
                }`}>
                {groupLabel(g)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
          <RefreshCw size={20} className="animate-spin" />
        </div>
      ) : bills.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {group
            ? (lang === 'he' ? 'לא נמצאו חוקים מסווגים לקבוצה זו.' : 'No classified bills found for this group yet.')
            : tx('noResults')}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right py-3 px-4 font-semibold text-gray-600 w-24">
                  {lang === 'he' ? 'סטטוס' : 'Status'}
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600 w-24">
                  {lang === 'he' ? 'הוגשה' : 'Date Filed'}
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600">
                  {lang === 'he' ? 'שם החוק' : 'Bill Name'}
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600 w-36">
                  {lang === 'he' ? 'מגיש' : 'Raised by'}
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600 w-32">
                  {lang === 'he' ? 'סיעה' : 'Party'}
                </th>
                <th className="text-right py-3 px-4 font-semibold text-gray-600 w-36">
                  {lang === 'he' ? 'סיווג' : 'Classification'}
                </th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bills.map(b => {
                const c = b.Classification;
                const isExpanded = expanded === b.BillID;
                const primary = b.Initiators[0] ?? null;
                const notableStances = c ? GROUPS.filter(g => c[g] !== 'neutral') : [];
                const cat = b.StatusCategory ?? (b.StatusID === 118 ? 'passed' : 'active');
                const statusDisplayLabel = lang === 'he' ? b.StatusDesc : b.StatusDescEn;
                const summaryState = billSummaries.get(b.BillID);

                return (
                  <>
                    <tr
                      key={b.BillID}
                      onClick={() => toggleExpand(b.BillID)}
                      className={`cursor-pointer transition-colors ${isExpanded ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                    >
                      {/* Status */}
                      <td className="py-3 px-4">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${categoryColor(cat)}`} dir="rtl">
                          {categoryIcon(cat)}
                          {statusDisplayLabel}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-4 text-xs text-gray-500 whitespace-nowrap">
                        {b.PublicationDate
                          ? new Date(b.PublicationDate).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '–'}
                      </td>

                      {/* Name */}
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900 leading-snug line-clamp-2" dir="rtl">{b.Name}</p>
                        {c?.summary && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1" dir="rtl">{c.summary}</p>
                        )}
                      </td>

                      {/* Initiator */}
                      <td className="py-3 px-4">
                        {primary ? (
                          <span className="text-xs text-gray-700 font-medium line-clamp-1" dir="rtl">
                            {primary.name}
                            {b.Initiators.length > 1 && (
                              <span className="text-gray-400 font-normal"> +{b.Initiators.length - 1}</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {b.IsGovernment ? (lang === 'he' ? 'ממשלה' : 'Gov.') : '–'}
                          </span>
                        )}
                      </td>

                      {/* Party */}
                      <td className="py-3 px-4">
                        <span className="text-xs text-gray-600 line-clamp-1" dir="rtl">
                          {primary?.faction ?? (b.IsGovernment ? (lang === 'he' ? 'ממשלה' : 'Government') : '–')}
                        </span>
                      </td>

                      {/* Classification */}
                      <td className="py-3 px-4">
                        {c ? (
                          <div className="flex flex-wrap gap-1">
                            {c.financial_impact !== 'unknown' && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${FINANCIAL_COLOR[c.financial_impact as FinancialImpact]}`}>
                                {c.financial_impact === 'positive' ? '💚' : c.financial_impact === 'negative' ? '🔴' : '⚪'}
                              </span>
                            )}
                            {notableStances.slice(0, 2).map(g => (
                              <span key={g} className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${STANCE_COLOR[c[g] as Stance]}`}>
                                {c[g] === 'pro' ? '▲' : '▼'} {groupLabel(g)}
                              </span>
                            ))}
                            {notableStances.length > 2 && (
                              <span className="text-xs text-gray-400">+{notableStances.length - 2}</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">{lang === 'he' ? 'לא מסווג' : 'Unclassified'}</span>
                        )}
                      </td>

                      {/* Expand toggle */}
                      <td className="py-3 px-2 text-gray-400">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${b.BillID}-expanded`} className="bg-blue-50">
                        <td colSpan={7} className="px-6 py-4 border-t border-blue-100">

                          {/* Header */}
                          <div className="flex items-start gap-2 mb-2">
                            <h3 className="font-semibold text-gray-900 leading-snug flex-1" dir="rtl">{b.Name}</h3>
                            <a
                              href={`https://main.knesset.gov.il/Activity/Legislation/Laws/Pages/LawBill.aspx?t=lawsuggestionssearch&lawitemid=${b.BillID}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:underline"
                            >
                              <ExternalLink size={13} />
                              {lang === 'he' ? 'אתר הכנסת' : 'Knesset site'}
                            </a>
                          </div>

                          {/* Meta */}
                          <div className="flex gap-4 text-xs text-gray-500 mb-3">
                            <span>{b.IsGovernment ? (lang === 'he' ? 'ממשלתית' : 'Government bill') : (lang === 'he' ? 'פרטית' : 'Private bill')}</span>
                            <span>{lang === 'he' ? `כנסת ${b.KnessetNum}` : `Knesset ${b.KnessetNum}`}</span>
                            {b.PublicationDate && (
                              <span>{new Date(b.PublicationDate).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US')}</span>
                            )}
                          </div>

                          {/* AI summary */}
                          {summaryState === 'loading' ? (
                            <div className="flex items-center gap-2 text-gray-400 text-xs py-1">
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

                              {/* Benefits + Concerns */}
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
                                    {GROUPS.filter(g => c[g] !== 'neutral').map(g => (
                                      <span key={g} className={`text-xs px-2 py-0.5 rounded-full font-medium ${STANCE_COLOR[c[g] as Stance]}`}>
                                        {c[g] === 'pro' ? '▲' : '▼'} {groupLabel(g)}
                                      </span>
                                    ))}
                                    {GROUPS.every(g => c[g] === 'neutral') && (
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
        </div>
      )}

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-5">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:border-blue-400 transition-colors">
            <ChevronLeft size={16} />{lang === 'he' ? 'הקודם' : 'Previous'}
          </button>
          <span className="text-sm text-gray-500">
            {lang === 'he'
              ? `עמוד ${page + 1} מתוך ${totalPages} · ${total.toLocaleString()} תוצאות`
              : `Page ${page + 1} of ${totalPages} · ${total.toLocaleString()} results`}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="flex items-center gap-1 px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium disabled:opacity-40 hover:border-blue-400 transition-colors">
            {lang === 'he' ? 'הבא' : 'Next'}<ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
