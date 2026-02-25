import React, { createContext, useContext, useState, useCallback } from 'react';
import { vi } from '../locales/vi';
import { en } from '../locales/en';
import { zh } from '../locales/zh';

export const LANGUAGES = [
    { code: 'vi', label: 'Tiếng Việt', flag: '🇻🇳', short: 'VI' },
    { code: 'en', label: 'Tiếng Anh', flag: '🇬🇧', short: 'EN' },
    { code: 'zh', label: 'Tiếng Trung', flag: '🇨🇳', short: '中' },
];

export const TRANSLATIONS = { vi, en, zh };

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
    const [lang, setLangState] = useState(() => {
        const saved = localStorage.getItem('nas_lang');
        return LANGUAGES.find(l => l.code === saved) ? saved : 'vi';
    });

    const setLang = useCallback((code) => {
        setLangState(code);
        localStorage.setItem('nas_lang', code);
    }, []);

    const t = useCallback((key) => {
        return TRANSLATIONS[lang]?.[key] ?? TRANSLATIONS['en'][key] ?? key;
    }, [lang]);

    const currentLang = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, currentLang, languages: LANGUAGES }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider');
    return ctx;
};
