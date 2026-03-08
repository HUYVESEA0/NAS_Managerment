const fs = require('fs');
const cssContent = fs.readFileSync('src/index.css', 'utf-8');
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
    --accent-blue: #DC2626; /* primary accent mapped to red */
    --accent-cyan: #EF4444; /* secondary red */
    --accent-glow: rgba(220, 38, 38, 0.15);

    /* Active nav */
    --nav-active-bg: rgba(220, 38, 38, 0.06); 
    --nav-active-text: #DC2626; 
    --nav-active-border: #DC2626;
    --nav-active-indicator: #DC2626;

    /* Semantic */
    --success: #10B981;
    --warning: #F59E0B;
    --danger: #EF4444;

    /* Shape */
    --radius-sm: 4px;
    --radius-md: 6px;
    --radius-lg: 8px;
    --radius-xl: 12px;

    /* Shadows */
    --shadow-card: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03);
    --shadow-glow: none;
    --shadow-elevated: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);

    color-scheme: light;
}`);
fs.writeFileSync('src/index.css', updatedCss);
console.log('Updated index.css');
