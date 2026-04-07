'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLang } from '@/lib/lang-context';
import { t } from '@/lib/translations';
import { Menu, X, Globe } from 'lucide-react';
import { useState } from 'react';

export default function Navbar() {
  const { lang, setLang } = useLang();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const tx = (key: string) => t[key]?.[lang] ?? key;

  const links = [
    { href: '/analytics', label: lang === 'he' ? 'אנליטיקה' : 'Analytics' },
    { href: '/members', label: tx('members') },
    { href: '/parties', label: tx('parties') },
    { href: '/bills', label: tx('bills') },
    { href: '/about', label: tx('about') },
  ];

  return (
    <nav className="bg-blue-900 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 font-bold text-xl hover:opacity-90">
            <span className="text-2xl">🕍</span>
            <span>{tx('appName')}</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {links.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className={`text-sm font-medium hover:text-blue-200 transition-colors ${
                  pathname === l.href ? 'text-yellow-300 border-b-2 border-yellow-300 pb-0.5' : ''
                }`}
              >
                {l.label}
              </Link>
            ))}
            {/* Language toggle */}
            <button
              onClick={() => setLang(lang === 'en' ? 'he' : 'en')}
              className="flex items-center gap-1 text-sm bg-blue-700 hover:bg-blue-600 px-3 py-1.5 rounded-full transition-colors"
              title="Switch language"
            >
              <Globe size={14} />
              {lang === 'en' ? 'עברית' : 'English'}
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-blue-800 px-4 pb-4 flex flex-col gap-3">
          {links.map(l => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`text-sm font-medium py-2 ${pathname === l.href ? 'text-yellow-300' : ''}`}
            >
              {l.label}
            </Link>
          ))}
          <button
            onClick={() => { setLang(lang === 'en' ? 'he' : 'en'); setOpen(false); }}
            className="text-sm text-left py-2 flex items-center gap-2"
          >
            <Globe size={14} />
            {lang === 'en' ? 'עברית' : 'English'}
          </button>
        </div>
      )}
    </nav>
  );
}
