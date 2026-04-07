'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Lang } from './translations';

interface LangContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  dir: 'ltr' | 'rtl';
}

const LangContext = createContext<LangContextType>({
  lang: 'en',
  setLang: () => {},
  dir: 'ltr',
});

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  function setLang(l: Lang) {
    setLangState(l);
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'he' ? 'rtl' : 'ltr';
    localStorage.setItem('lang', l);
  }

  useEffect(() => {
    const saved = localStorage.getItem('lang') as Lang | null;
    if (saved === 'he' || saved === 'en') setLang(saved);
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang, dir: lang === 'he' ? 'rtl' : 'ltr' }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  return useContext(LangContext);
}
