const fs = require('fs');
const content = `import React from 'react';
import { Sun, Moon, TerminalSquare } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

const ThemeToggle = ({ compact = false }) => {
    const { isDark, toggleTheme } = useTheme();

    return (
        <button
            onClick={toggleTheme}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className={\`group flex items-center justify-center gap-2 border transition-all duration-200 uppercase tracking-widest font-mono font-bold
                \${compact ? 'p-1.5' : 'px-3 py-1.5'}
                \${isDark 
                    ? 'bg-base text-primary border-border-strong hover:border-accent hover:bg-accent/10 hover:shadow-glow' 
                    : 'bg-base text-primary border-border-strong hover:bg-border-strong hover:text-base'}
            \`}
        >
            {isDark ? (
                <TerminalSquare size={14} className="transition-transform group-hover:scale-110" />
            ) : (
                <Sun size={14} className="transition-transform group-hover:scale-110" />
            )}
            {!compact && (
                <span className="text-[10px]">
                    {isDark ? 'SYS:DARK' : 'SYS:LITE'}
                </span>
            )}
        </button>
    );
};

export default ThemeToggle;
`;
fs.writeFileSync('client/src/components/ThemeToggle.jsx', content);
console.log('Updated ThemeToggle');
