export type Lang = 'en' | 'he';

export const t: Record<string, Record<Lang, string>> = {
  // Nav
  appName: { en: 'Knesset Watch', he: 'מעקב כנסת' },
  members: { en: 'Members', he: 'חברי כנסת' },
  parties: { en: 'Parties', he: 'סיעות' },
  bills: { en: 'Bills & Laws', he: 'חוקים והצעות חוק' },
  about: { en: 'About', he: 'אודות' },

  // Home
  heroTitle: { en: 'Your Parliament, Made Simple', he: 'הכנסת שלך, בפשטות' },
  heroSub: {
    en: 'Track every member of the Israeli Knesset — their votes, attendance, bills, and more.',
    he: 'עקבו אחרי כל חבר כנסת — הצבעות, נוכחות, חוקים ועוד.',
  },
  searchPlaceholder: { en: 'Search members, parties, bills…', he: 'חיפוש חברי כנסת, סיעות, חוקים…' },
  search: { en: 'Search', he: 'חיפוש' },

  // Stats
  totalMembers: { en: 'Members of Knesset', he: 'חברי כנסת' },
  totalParties: { en: 'Parties', he: 'סיעות' },
  totalBills: { en: 'Bills This Term', he: 'הצעות חוק בכנסת' },
  totalLaws: { en: 'Laws Passed', he: 'חוקים שעברו' },

  // Members
  attendance: { en: 'Attendance', he: 'נוכחות' },
  billsProposed: { en: 'Bills Proposed', he: 'הצעות חוק' },
  billsPassed: { en: 'Bills Passed', he: 'חוקים שעברו' },
  party: { en: 'Party', he: 'סיעה' },
  role: { en: 'Role', he: 'תפקיד' },
  viewProfile: { en: 'View Profile', he: 'לפרופיל' },
  loading: { en: 'Loading…', he: 'טוען…' },
  error: { en: 'Failed to load data', he: 'שגיאה בטעינת הנתונים' },
  noResults: { en: 'No results found', he: 'לא נמצאו תוצאות' },

  // Member profile
  votingRecord: { en: 'Voting Record', he: 'היסטוריית הצבעות' },
  recentBills: { en: 'Recent Bills', he: 'הצעות חוק אחרונות' },
  newsSummary: { en: 'News Summary (AI)', he: 'סיכום חדשות (AI)' },
  socialSummary: { en: 'Social Media Summary (AI)', he: 'סיכום רשתות חברתיות (AI)' },
  generateSummary: { en: 'Generate AI Summary', he: 'צור סיכום AI' },
  generating: { en: 'Generating…', he: 'מייצר סיכום…' },

  // Votes
  voteYes: { en: 'Yes', he: 'בעד' },
  voteNo: { en: 'No', he: 'נגד' },
  voteAbstain: { en: 'Abstain', he: 'נמנע' },
  voteAbsent: { en: 'Absent', he: 'נעדר' },

  // Bills
  billStatus: { en: 'Status', he: 'סטטוס' },
  billDate: { en: 'Date', he: 'תאריך' },
  billPassed: { en: 'Passed', he: 'עבר' },
  billPending: { en: 'Pending', he: 'בדיון' },
  billRejected: { en: 'Rejected', he: 'נדחה' },

  // Parties
  seats: { en: 'Seats', he: 'מנדטים' },
  coalition: { en: 'Coalition', he: 'קואליציה' },
  opposition: { en: 'Opposition', he: 'אופוזיציה' },

  // Footer
  dataSource: {
    en: 'Data from the Knesset Open Data API',
    he: 'נתונים ממאגר הנתונים הפתוח של הכנסת',
  },
  disclaimer: {
    en: 'AI summaries are generated automatically and may not be fully accurate.',
    he: 'סיכומי AI נוצרים אוטומטית ועלולים לא להיות מדויקים לחלוטין.',
  },
};
