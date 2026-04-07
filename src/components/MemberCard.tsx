'use client';

import Link from 'next/link';
import { useLang } from '@/lib/lang-context';
import { t } from '@/lib/translations';
import { RealMember } from '@/lib/knesset-api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  member: RealMember;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-purple-500', 'bg-green-600', 'bg-orange-500',
  'bg-red-500', 'bg-teal-500', 'bg-indigo-500', 'bg-pink-500',
  'bg-cyan-600', 'bg-rose-500', 'bg-amber-600', 'bg-lime-600',
];

const COALITION_BADGE = 'bg-blue-100 text-blue-700';
const OPPOSITION_BADGE = 'bg-gray-100 text-gray-600';

export default function MemberCard({ member }: Props) {
  const { lang } = useLang();
  const tx = (key: string) => t[key]?.[lang] ?? key;
  const isRTL = lang === 'he';

  const name = lang === 'he' ? member.FullName : (member.FullNameEng || member.FullName);
  const party = lang === 'he' ? member.FactionName : (member.FactionNameEng || member.FactionName);
  const role = lang === 'he' ? member.RoleHe : (member.RoleEng || member.RoleHe);
  const isMK = role === 'חבר הכנסת' || role === 'חברת כנסת' || role === 'Member of Knesset';

  const words = name.split(' ').filter(Boolean);
  const initials = words.length >= 2 ? `${words[0][0]}${words[words.length - 1][0]}` : name.slice(0, 2);
  const color = AVATAR_COLORS[member.PersonID % AVATAR_COLORS.length];
  const ArrowIcon = isRTL ? ChevronLeft : ChevronRight;

  return (
    <Link href={`/member/${member.PersonID}`}>
      <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group h-full flex flex-col gap-3">
        {/* Avatar + Name */}
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors text-sm leading-tight truncate">{name}</h3>
            {party && <p className="text-xs text-blue-600 font-medium truncate mt-0.5">{party}</p>}
          </div>
        </div>

        {/* Role badge */}
        {!isMK && role && (
          <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full self-start truncate max-w-full">
            {role}
          </span>
        )}

        {/* Footer row */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${member.FactionID && [1095,1096,1101,1105,1106,1107,1108].includes(member.FactionID) ? COALITION_BADGE : OPPOSITION_BADGE}`}>
            {member.FactionID && [1095,1096,1101,1105,1106,1107,1108].includes(member.FactionID)
              ? (lang === 'he' ? 'קואליציה' : 'Coalition')
              : (lang === 'he' ? 'אופוזיציה' : 'Opposition')}
          </span>
          <span className="text-xs text-blue-500 flex items-center gap-0.5 group-hover:text-blue-700 font-medium">
            {lang === 'he' ? 'לפרופיל' : 'Profile'}
            <ArrowIcon size={12} />
          </span>
        </div>
      </div>
    </Link>
  );
}
