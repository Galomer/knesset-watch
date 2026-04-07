'use client';

import { useLang } from '@/lib/lang-context';
import { t } from '@/lib/translations';

type Decision = 'for' | 'against' | 'abstain' | 'absent';

const styles: Record<Decision, string> = {
  for: 'bg-green-100 text-green-800 border-green-300',
  against: 'bg-red-100 text-red-800 border-red-300',
  abstain: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  absent: 'bg-gray-100 text-gray-600 border-gray-300',
};

const icons: Record<Decision, string> = {
  for: '✓',
  against: '✗',
  abstain: '−',
  absent: '○',
};

export default function VoteBadge({ decision }: { decision: Decision }) {
  const { lang } = useLang();
  const labels: Record<Decision, string> = {
    for: t.voteYes[lang],
    against: t.voteNo[lang],
    abstain: t.voteAbstain[lang],
    absent: t.voteAbsent[lang],
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded border ${styles[decision]}`}>
      <span>{icons[decision]}</span>
      {labels[decision]}
    </span>
  );
}
