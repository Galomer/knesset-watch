'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLang } from '@/lib/lang-context';
import { t } from '@/lib/translations';
import MemberCard from '@/components/MemberCard';
import { RealMember, getMockMembers } from '@/lib/knesset-api';
import { Search, Users, Building2, FileText, CheckSquare, RefreshCw } from 'lucide-react';

interface Stats { total: number; passed: number; sessions: number }

export default function MembersPage() {
  const { lang } = useLang();
  const tx = (key: string) => t[key]?.[lang] ?? key;

  const [members, setMembers] = useState<RealMember[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 7296, passed: 516, sessions: 385 });
  const [search, setSearch] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const [memberRes, statsRes] = await Promise.all([
          fetch('/api/members'),
          fetch('/api/stats'),
        ]);
        if (memberRes.ok) setMembers(await memberRes.json());
        else { setMembers(getMockMembers()); setError(true); }
        if (statsRes.ok) setStats(await statsRes.json());
      } catch {
        setMembers(getMockMembers());
        setError(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const uniqueParties = useMemo(() => {
    const seen = new Map<string, string>();
    for (const m of members) {
      const key = m.FactionID?.toString() ?? m.FactionName;
      if (!seen.has(key)) seen.set(key, lang === 'he' ? m.FactionName : m.FactionNameEng || m.FactionName);
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [members, lang]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return members.filter(m => {
      const matchSearch = !q ||
        m.FullName.toLowerCase().includes(q) ||
        m.FullNameEng.toLowerCase().includes(q) ||
        m.FactionName.toLowerCase().includes(q) ||
        m.FactionNameEng.toLowerCase().includes(q) ||
        m.RoleHe.toLowerCase().includes(q) ||
        m.RoleEng.toLowerCase().includes(q);
      const mPartyKey = m.FactionID?.toString() ?? m.FactionName;
      const matchParty = !partyFilter || mPartyKey === partyFilter;
      return matchSearch && matchParty;
    });
  }, [members, search, partyFilter]);

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-900 via-blue-800 to-blue-700 text-white py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-5xl mb-4">🕍</div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">{tx('heroTitle')}</h1>
          <p className="text-blue-200 text-lg mb-8 max-w-2xl mx-auto">{tx('heroSub')}</p>
          <div className="flex gap-2 max-w-xl mx-auto">
            <div className="flex-1 relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={tx('searchPlaceholder')}
                className="w-full pl-10 pr-4 py-3 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
                dir={lang === 'he' ? 'rtl' : 'ltr'}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { icon: <Users size={20} className="text-blue-600" />, value: members.length || 120, label: tx('totalMembers') },
            { icon: <Building2 size={20} className="text-purple-600" />, value: uniqueParties.length || 12, label: tx('totalParties') },
            { icon: <FileText size={20} className="text-orange-600" />, value: stats.total.toLocaleString(), label: tx('totalBills') },
            { icon: <CheckSquare size={20} className="text-green-600" />, value: stats.passed.toLocaleString(), label: tx('totalLaws') },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50">
              {s.icon}
              <div>
                <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                <div className="text-xs text-gray-500">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Real-data notice */}
      {!loading && !error && members.length > 10 && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-sm text-green-700 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block flex-shrink-0" />
            {lang === 'he'
              ? `מציג ${members.length} חברי כנסת מנתוני הכנסת הרשמיים · עודכן בשעה האחרונה`
              : `Showing ${members.length} MKs from the official Knesset Open Data API · Updated hourly`}
          </div>
        </div>
      )}
      {error && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2 text-sm text-yellow-700 flex items-center gap-2">
            <RefreshCw size={14} />
            {lang === 'he' ? 'API הכנסת אינו זמין כרגע — מציג נתוני דגימה' : 'Knesset API unavailable — showing sample data'}
          </div>
        </div>
      )}

      {/* Filters + Grid */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-2 flex-wrap mb-6">
          <button
            onClick={() => setPartyFilter('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              partyFilter === '' ? 'bg-blue-700 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'
            }`}
          >
            {lang === 'he' ? 'הכל' : 'All'}
          </button>
          {uniqueParties.map(p => (
            <button
              key={p.id}
              onClick={() => setPartyFilter(partyFilter === p.id ? '' : p.id)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                partyFilter === p.id ? 'bg-blue-700 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:border-blue-400'
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="inline-flex items-center gap-3 text-gray-500">
              <RefreshCw size={20} className="animate-spin" />
              <span>{lang === 'he' ? 'טוען נתוני כנסת רשמיים…' : 'Loading official Knesset data…'}</span>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">{tx('noResults')}</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(member => (
              <MemberCard key={member.PersonID} member={member} />
            ))}
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-6">
            {lang === 'he' ? `מציג ${filtered.length} מתוך ${members.length} חברי כנסת` : `Showing ${filtered.length} of ${members.length} members`}
          </p>
        )}
      </div>
    </div>
  );
}
