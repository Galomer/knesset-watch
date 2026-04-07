'use client';

import { useLang } from '@/lib/lang-context';

export default function AboutPage() {
  const { lang } = useLang();
  const isRTL = lang === 'he';

  const content = {
    en: {
      title: 'About Knesset Watch',
      intro: 'Knesset Watch is a free, non-partisan tool that makes Israeli parliament data accessible to everyone.',
      sections: [
        {
          title: 'What is the Knesset?',
          body: 'The Knesset (כנסת) is Israel\'s parliament. It has 120 members (MKs) elected by proportional representation. The party or coalition that wins a majority of seats forms the government. The Knesset meets in Jerusalem and is responsible for passing laws, approving the budget, and overseeing the government.',
        },
        {
          title: 'What data do we show?',
          body: 'We pull official data from the Knesset\'s Open Data API — including member profiles, attendance records, bills proposed and passed, and voting records. All data is publicly available from the Israeli government.',
        },
        {
          title: 'What is the AI summary feature?',
          body: 'Using Claude AI by Anthropic, we generate plain-language summaries of each MK\'s positions and public record. These are automatically generated and may not be perfectly accurate — always check primary sources for important decisions.',
        },
        {
          title: 'Who built this?',
          body: 'This is an open civic tech project. The goal is simple: make democracy more transparent and accessible. No political affiliation.',
        },
      ],
    },
    he: {
      title: 'אודות מעקב כנסת',
      intro: 'מעקב כנסת הוא כלי חינמי ובלתי מפלגתי שהופך את נתוני הכנסת לנגישים לכולם.',
      sections: [
        {
          title: 'מהי הכנסת?',
          body: 'הכנסת היא הפרלמנט של ישראל. יש בה 120 חברים הנבחרים בשיטה היחסית. המפלגה או הקואליציה שזוכה לרוב מושבים מרכיבה את הממשלה. הכנסת מתכנסת בירושלים ואחראית על חקיקת חוקים, אישור התקציב, ופיקוח על הממשלה.',
        },
        {
          title: 'אילו נתונים אנו מציגים?',
          body: 'אנו שואבים נתונים רשמיים מממשק ה-API הפתוח של הכנסת — כולל פרופילי חברי כנסת, נוכחות בישיבות, הצעות חוק, חוקים שעברו ורשומות הצבעות. כל הנתונים זמינים לציבור ממשלת ישראל.',
        },
        {
          title: 'מהי תכונת הסיכום ב-AI?',
          body: 'בעזרת Claude AI של Anthropic, אנו מייצרים סיכומים בשפה פשוטה על עמדות כל חבר כנסת ורשומותיו הציבוריות. הסיכומים נוצרים אוטומטית ועלולים לא להיות מדויקים לחלוטין — תמיד בדקו מקורות ראשוניים לקבלת החלטות חשובות.',
        },
        {
          title: 'מי בנה את זה?',
          body: 'זהו פרויקט טכנולוגיה אזרחית פתוחה. המטרה פשוטה: להפוך את הדמוקרטיה לשקופה ונגישה יותר. ללא שיוך מפלגתי.',
        },
      ],
    },
  };

  const c = content[lang];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">🕍</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{c.title}</h1>
        <p className="text-gray-500 text-lg">{c.intro}</p>
      </div>

      <div className="space-y-6">
        {c.sections.map((s, i) => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="font-bold text-gray-800 text-lg mb-2">{s.title}</h2>
            <p className="text-gray-600 leading-relaxed">{s.body}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 p-4 bg-blue-50 rounded-xl text-sm text-blue-700 text-center">
        {lang === 'he'
          ? 'נתונים: ממשק API פתוח של הכנסת · AI: Claude מבית Anthropic'
          : 'Data: Knesset Open Data API · AI: Claude by Anthropic'}
      </div>
    </div>
  );
}
