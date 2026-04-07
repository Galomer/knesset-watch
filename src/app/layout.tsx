import type { Metadata } from 'next';
import { Poppins } from 'next/font/google';
import './globals.css';
import { LangProvider } from '@/lib/lang-context';
import Navbar from '@/components/Navbar';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Knesset Watch | מעקב כנסת',
  description: 'Track every member of the Israeli Knesset — votes, attendance, bills, and more.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" dir="ltr">
      <body className={`${poppins.variable} min-h-screen bg-gray-50 flex flex-col`}>
        <LangProvider>
          <Navbar />
          <main className="flex-1">
            {children}
          </main>
          <footer className="bg-blue-900 text-blue-200 text-center text-xs py-4 px-4 mt-8">
            <p>Data from the Knesset Open Data API · נתונים ממאגר הנתונים הפתוח של הכנסת</p>
            <p className="mt-1 text-blue-300">AI summaries are generated automatically and may not be fully accurate.</p>
          </footer>
        </LangProvider>
      </body>
    </html>
  );
}
