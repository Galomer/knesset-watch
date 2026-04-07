'use client';

import { useEffect, useState } from 'react';
import { useLang } from '@/lib/lang-context';
import { t } from '@/lib/translations';
import { RealParty, RealMember } from '@/lib/knesset-api';
import Link from 'next/link';
import { RefreshCw } from 'lucide-react';

const PARTY_COLORS = [
  'bg-blue-600', 'bg-indigo-500', 'bg-purple-500', 'bg-teal-500',
  'bg-orange-500', 'bg-green-600', 'bg-red-500', 'bg-pink-500',
  'bg-cyan-600', 'bg-amber-600', 'bg-rose-500', 'bg-lime-600',
];

export default function PartiesPage() {
  const { lang } = useLang();
  const tx = (key: string) => t[key]?.[lang] ?? key;
  const isRTL = lang === 'he';

  const [parties, setParties] = useState<RealParty[]>([]);
  const [members, setMembers] = useState<RealMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetch('/api/parties'), fetch('/api/members')])
      .then(async ([pr, mr]) => {
        if (pr.ok) setParties(await pr.json());
        if (mr.ok) setMembers(await mr.json());
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalSeats = parties.reduce((s, p) => s + p.Seats, 0) || 120;
  const coalitionSeats = parties.filter(p => p.IsCoalition).reduce((s, p) => s + p.Seats, 0);

  const getMembersForParty = (party: RealParty) =>
    members.filter(m => m.FactionID === party.FactionID);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
        <RefreshCw size={20} className="animate-spin" />
        <span>{lang === 'he' ? 'טוען נתוני סיעות…' : 'Loading party data…'}</span>
      </div>
    );
  }

  const coalition = parties.filter(p => p.IsCoalition);
  const opposition = parties.filter(p => !p.IsCoalition);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8" dir={isRTL ? 'rtl' : 'ltr'}>
      <h1 className="text-3xl font-bold text-gray-900 mb-2">{tx('parties')}</h1>
      <p className="text-gray-500 mb-6">
        {lang === 'he'
          ? `כנסת ה-${25} · קואליציה: ${coalitionSeats} מנדטים מתוך ${totalSeats}`
          : `25th Knesset · Coalition: ${coalitionSeats} of ${totalSeats} seats`}
      </p>

      {/* Seat distribution bar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-8">
        <h2 className="font-semibold text-gray-700 mb-3">
          {lang === 'he' ? 'התפלגות המנדטים' : 'Seat Distribution'}
        </h2>
        <div className="flex h-10 rounded-full overflow-hidden gap-0.5">
          {parties.map((party, i) => (
            <div
              key={party.FactionID}
              className={`${PARTY_COLORS[i % PARTY_COLORS.length]} ${party.IsCoalition ? 'opacity-100' : 'opacity-50'} transition-all hover:opacity-80 cursor-default flex items-center justify-center`}
              style={{ width: `${(party.Seats / totalSeats) * 100}%` }}
              title={`${lang === 'he' ? party.Name : party.NameEng}: ${party.Seats} ${lang === 'he' ? 'מנדטים' : 'seats'}`}
            >
              {party.Seats >= 6 && (
                <span className="text-white text-xs font-bold">{party.Seats}</span>
              )}
            </div>
          ))}
        </div>
        <div className="flex gap-6 mt-3 text-xs text-gray-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
            {tx('coalition')} ({coalitionSeats} {lang === 'he' ? 'מנדטים' : 'seats'})
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 opacity-50 inline-block" />
            {tx('opposition')} ({totalSeats - coalitionSeats} {lang === 'he' ? 'מנדטים' : 'seats'})
          </span>
        </div>

        {/* Party legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100">
          {parties.map((party, i) => (
            <div key={party.FactionID} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span className={`w-2.5 h-2.5 rounded-full ${PARTY_COLORS[i % PARTY_COLORS.length]} ${party.IsCoalition ? '' : 'opacity-50'} inline-block`} />
              {lang === 'he' ? party.Name : party.NameEng} ({party.Seats})
            </div>
          ))}
        </div>
      </div>

      {/* Coalition */}
      {coalition.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block" />
            {tx('coalition')} · {coalitionSeats} {tx('seats')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {coalition.map((party, i) => {
              const partyMembers = getMembersForParty(party);
              const pName = lang === 'he' ? party.Name : party.NameEng;
              return (
                <div key={party.FactionID} className="bg-white rounded-xl border border-blue-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full ${PARTY_COLORS[i % PARTY_COLORS.length]} flex items-center justify-center text-white font-bold text-lg`}>
                      {party.Seats}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{pName}</h3>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{tx('coalition')}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                    <div className={`h-full rounded-full ${PARTY_COLORS[i % PARTY_COLORS.length]}`}
                      style={{ width: `${(party.Seats / totalSeats) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {party.Seats} {tx('seats')} · {partyMembers.length} {lang === 'he' ? 'חברי כנסת' : 'MKs'}
                  </p>
                  {partyMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {partyMembers.slice(0, 5).map(m => (
                        <Link key={m.PersonID} href={`/member/${m.PersonID}`}
                          className="text-xs bg-gray-100 hover:bg-blue-100 text-gray-700 px-2 py-1 rounded-full transition-colors">
                          {lang === 'he' ? m.FullName : (m.FullNameEng || m.FullName)}
                        </Link>
                      ))}
                      {partyMembers.length > 5 && (
                        <span className="text-xs text-gray-400 px-2 py-1">+{partyMembers.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Opposition */}
      {opposition.length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-400 inline-block" />
            {tx('opposition')} · {totalSeats - coalitionSeats} {tx('seats')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {opposition.map((party, i) => {
              const colorIdx = coalition.length + i;
              const partyMembers = getMembersForParty(party);
              const pName = lang === 'he' ? party.Name : party.NameEng;
              return (
                <div key={party.FactionID} className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-12 h-12 rounded-full ${PARTY_COLORS[colorIdx % PARTY_COLORS.length]} opacity-70 flex items-center justify-center text-white font-bold text-lg`}>
                      {party.Seats}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900">{pName}</h3>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tx('opposition')}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full mb-3">
                    <div className={`h-full rounded-full ${PARTY_COLORS[colorIdx % PARTY_COLORS.length]} opacity-70`}
                      style={{ width: `${(party.Seats / totalSeats) * 100}%` }} />
                  </div>
                  <p className="text-xs text-gray-500 mb-3">
                    {party.Seats} {tx('seats')} · {partyMembers.length} {lang === 'he' ? 'חברי כנסת' : 'MKs'}
                  </p>
                  {partyMembers.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {partyMembers.slice(0, 5).map(m => (
                        <Link key={m.PersonID} href={`/member/${m.PersonID}`}
                          className="text-xs bg-gray-100 hover:bg-blue-100 text-gray-700 px-2 py-1 rounded-full transition-colors">
                          {lang === 'he' ? m.FullName : (m.FullNameEng || m.FullName)}
                        </Link>
                      ))}
                      {partyMembers.length > 5 && (
                        <span className="text-xs text-gray-400 px-2 py-1">+{partyMembers.length - 5}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
