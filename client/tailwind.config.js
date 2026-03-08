/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                base: 'var(--bg-base)',
                surface: 'var(--bg-surface)',
                elevated: 'var(--bg-elevated)',
                card: 'var(--bg-card)',
                hover: 'var(--bg-hover)',
                primary: 'var(--text-primary)',
                secondary: 'var(--text-secondary)',
                muted: 'var(--text-muted)',
                accent: {
                    DEFAULT: 'var(--accent-blue)',
                    cyan: 'var(--accent-cyan)',
                    glow: 'var(--accent-glow)'
                },
                success: 'var(--success)',
                warning: 'var(--warning)',
                danger: 'var(--danger)',
                border: {
                    subtle: 'var(--border-subtle)',
                    DEFAULT: 'var(--border-default)',
                    strong: 'var(--border-strong)'
                }
            },
            fontFamily: {
                sans: ['"Fira Code"', 'monospace'],
                mono: ['"Fira Code"', 'monospace'],
            },
            boxShadow: {
                card: 'var(--shadow-card)',
                glow: 'var(--shadow-glow)',
                elevated: 'var(--shadow-elevated)'
            }
        },
    },
    plugins: [],
}
