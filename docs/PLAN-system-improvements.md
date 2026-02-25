# PLAN: System Improvements & Hardening

**Task:** Propose comprehensive improvements for the NAS Management System based on Frontend Design, SEO Fundamentals, and Server Management guidelines.
**Status:** DRAFT

---

## 🏗️ Phase 1: Server Management & Security (The Foundation)
Based on `server-management.md` principles, the backend needs to move from a "development script" mentality to a "production-ready" architecture.

1. **Process Management (PM2)**
   - **Current State:** Using `node index.js` in a `.bat` file (which can crash and not recover).
   - **Action:** Introduce PM2 to run the backend in cluster mode, ensuring auto-recovery (`restart on crash`) and log rotation.
2. **Deep Health Checks & Monitoring**
   - **Current State:** `/health` only returns an uptime string.
   - **Action:** Enhance `/health` to verify Database (Prisma) connectivity and Network capacities.
3. **Security Hardening (Rate Limiting & Logging)**
   - **Current State:** `morgan` for basic logging; no brute-force protection.
   - **Action:** Add `express-rate-limit` to the `/api/auth/login` endpoint. Shift to structured JSON logging (Winston/Pino) for easier audit trails.
4. **Dockerization (Optional but Recommended)**
   - **Action:** Create `Dockerfile` and `docker-compose.yml` to bundle PostgreSQL, Server, and built Client into unified containers.

---

## 🎨 Phase 2: Frontend UX & Accessibility (frontend-design)
Based on the "Wow Factor" and "UX Psychology" principles.

1. **Accessibility (a11y) for Drag & Drop**
   - **Action:** The current drag-and-drop feature is mouse-only. Add ARIA roles (`aria-grabbed`, `aria-dropeffect`) and a keyboard-navigable fallback (e.g., a "Move To" button appearing on hover/focus).
2. **Responsive & Tablet Layouts**
   - **Action:** NAS administrators often use tablets/iPads in server rooms. Ensure grids, tables, and modal sizes adapt gracefully.
3. **Micro-interactions & Perceived Performance**
   - **Action:** Replace static "Loading..." text with sleek Skeleton Loaders (`<div className="skeleton">`).
   - Add localized Toast notifications with smooth `ease-out` animations.
4. **Global Breadcrumbs & "Command Palette"**
   - **Action:** Implement a `Ctrl+K` (or `Cmd+K`) spotlight search to quickly format/jump to specific Machines without clicking through menus (Miller's Law - speed up workflows).

---

## 🔍 Phase 3: SEO Fundamentals & Discoverability
Although this is an internal dashboard, web indexing best practices improve internal site stability and PWA (Progressive Web App) readiness.

1. **Semantic HTML Refactoring**
   - **Current State:** Heavy reliance on generic `<div>` wrappers.
   - **Action:** Use correct semantic tags: `<main>` for content, `<aside>` for the sidebar, `<nav>` for menus, and `<section>` for cards.
2. **Dynamic Title Routing**
   - **Action:** Use React Helmet (or native `document.title`) to dynamically change the browser tab title: "Dashboard — NAS Manager", "Admin Panel — NAS Manager".
3. **Core Web Vitals (Performance)**
   - **Action:** Implement React Code Splitting (`React.lazy`). Currently, `FileSystem`, `Admin`, and `NetworkScanner` are bundled together. Splitting them will drastically reduce the initial JS payload size (LCP improvement).

---

## 📝 Verification Checklist
- [ ] Backend runs via PM2 or Docker, surviving a manual crash (`process.exit(1)`).
- [ ] Login page handles 10 rapid failed attempts by locking out the IP.
- [ ] Admin Drag-and-Drop is accessible by Keyboard (Tab/Enter).
- [ ] Lighthouse Audit (`ux_audit.py`) scores >95 in Performance & Accessibility.
