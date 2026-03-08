const fs = require('fs');

const cssContent = fs.readFileSync('client/src/index.css', 'utf-8');

const updatedCss = cssContent.replace(/\/\* ── Light Theme.*?color-scheme: light;\n}/s, `/* ── Light Theme (Tech Clean / Red Accent) ─────────────── */
:root,
html.light {
    /* Backgrounds */
    --bg-base: #F8FAFC;
    --bg-surface: #FFFFFF;
    --bg-elevated: #FFFFFF;
    --bg-card: #FFFFFF;
    --bg-hover: #F1F5F9;

    /* Grid pattern */
    --grid-line: rgba(0, 0, 0, 0.02);

    /* Borders */
    --border-subtle: #E2E8F0;
    --border-default: #CBD5E1; 
    --border-strong: #94A3B8;

    /* Text */
    --text-primary: #0F172A;
    --text-secondary: #475569;
    --text-muted: #94A3B8;

    /* Accent - Red */
    --accent-blue: #EF4444; /* Using the primary accent as Red */
    --accent-cyan: #F87171; /* Secondary accent */
    --accent-glow: rgba(239, 68, 68, 0.15);

    /* Active nav */
    --nav-active-bg: rgba(239, 68, 68, 0.08); /* Faint red */
    --nav-active-text: #EF4444; /* Red text */
    --nav-active-border: #EF4444;
    --nav-active-indicator: #EF4444;

    /* Semantic */
    --success: #10B981;
    --warning: #F59E0B;
    --danger: #EF4444;

    /* Shape */
    --radius-sm: 6px;
    --radius-md: 8px;
    --radius-lg: 12px;
    --radius-xl: 16px;

    /* Shadows */
    --shadow-card: 0 2px 4px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02);
    --shadow-glow: none;
    --shadow-elevated: 0 4px 6px -1px rgba(0, 0, 0, 0.08), 0 2px 4px -1px rgba(0, 0, 0, 0.04);

    color-scheme: light;
}`);

fs.writeFileSync('client/src/index.css', updatedCss);
console.log('Updated index.css');
