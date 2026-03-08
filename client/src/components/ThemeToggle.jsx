import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function ThemeToggle() {
    const { isDark, toggleTheme } = useTheme();
    const { t } = useLanguage();

    return (
        <button
            onClick={toggleTheme}
            className="p-2 ml-4 rounded-full hover:bg-hover active:scale-95 transition-all text-secondary hover:text-primary relative group"
            title={t('toggleTheme')}
        >
            <div className="relative w-5 h-5 flex items-center justify-center">
                <Sun
                    size={20}
                    className={`absolute transition-all duration-300 \${isDark ? 'opacity-0 rotate-90 scale-50' : 'opacity-100 rotate-0 scale-100'}`}
                />
                <Moon
                    size={20}
                    className={`absolute transition-all duration-300 \${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-50'}`}
                />
            </div>
            
            {/* Tooltip */}
            <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-elevated text-[10px] font-mono tracking-wider px-2 py-1 rounded border border-border-subtle opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {isDark ? t('lightMode') : t('darkMode')}
            </span>
        </button>
    );
}
