// ── Group definitions ─────────────────────────────────────────────────────────

export const GROUPS = [
  'seniors', 'children', 'lgbt', 'ultra_orthodox', 'religious',
  'liberals', 'women', 'soldiers', 'working_class', 'unemployed',
  'arabs', 'druze', 'secular',
] as const;

export type Group = typeof GROUPS[number];

export const GROUP_LABEL: Record<Group, { en: string; he: string }> = {
  seniors:        { en: 'Seniors',         he: 'קשישים' },
  children:       { en: 'Children',        he: 'ילדים' },
  lgbt:           { en: 'LGBT+',           he: 'להט"ב' },
  ultra_orthodox: { en: 'Ultra-Orthodox',  he: 'חרדים' },
  religious:      { en: 'Religious',       he: 'דתיים' },
  liberals:       { en: 'Liberals',        he: 'ליברלים' },
  women:          { en: 'Women',           he: 'נשים' },
  soldiers:       { en: 'Soldiers',        he: 'חיילים' },
  working_class:  { en: 'Working Class',   he: 'מעמד עובד' },
  unemployed:     { en: 'Unemployed',      he: 'מובטלים' },
  arabs:          { en: 'Arabs',           he: 'ערבים' },
  druze:          { en: 'Druze',           he: 'דרוזים' },
  secular:        { en: 'Secular',         he: 'חילונים' },
};

export type Stance = 'pro' | 'neutral' | 'anti';
export type FinancialImpact = 'positive' | 'negative' | 'neutral' | 'unknown';

export interface BillClassification {
  bill_id: number;
  benefits: string[];
  hurts: string[];
  financial_impact: FinancialImpact;
  financial_note: string;
  seniors: Stance;
  children: Stance;
  lgbt: Stance;
  ultra_orthodox: Stance;
  religious: Stance;
  liberals: Stance;
  women: Stance;
  soldiers: Stance;
  working_class: Stance;
  unemployed: Stance;
  arabs: Stance;
  druze: Stance;
  secular: Stance;
  confidence: 'high' | 'medium' | 'low';
  classified_at: string;
  summary: string;
}

export const STANCE_COLOR: Record<Stance, string> = {
  pro:     'bg-green-100 text-green-800',
  neutral: 'bg-gray-100 text-gray-500',
  anti:    'bg-red-100 text-red-800',
};

export const FINANCIAL_COLOR: Record<FinancialImpact, string> = {
  positive: 'bg-green-100 text-green-700',
  negative: 'bg-red-100 text-red-700',
  neutral:  'bg-gray-100 text-gray-600',
  unknown:  'bg-gray-50 text-gray-400',
};
