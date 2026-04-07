# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # Start dev server on port 8080
npm run build      # Production build
npm run build:dev  # Development build
npm run lint       # Run ESLint
npm run preview    # Preview production build
```

There are no tests in this project.

The `@` alias maps to `./src/` (configured in `vite.config.ts`).

## Architecture

This is a **class attendance logger** for a university workshop ("Taller de medios"), built with Vite + React + TypeScript + Tailwind CSS + shadcn/ui.

### Routes

- `/` — Student-facing attendance form (`src/pages/Index.tsx`)
- `/login` — Teacher login (`src/pages/Login.tsx`)
- `/panel` — Teacher dashboard, protected by `ProtectedRoute` (`src/pages/TeacherPanel.tsx`)

### Authentication

Auth is handled entirely client-side via `src/context/AuthContext.tsx`. It uses a hardcoded `MOCK_USERS` array (no real backend auth). Session is persisted in `localStorage` under the key `authUser`.

### Data flow for attendance submission

When a student submits the form on `/`:
1. **Primary**: POST to `/.netlify/functions/registrar-asistencia` → saves to **Neon PostgreSQL** (`asistencias` table). Returns 409 if duplicate (same student + same date via UNIQUE constraint).
2. **Backup**: `sheetsService.markAttendance()` → sends data to a **Make (formerly Integromat) webhook** (`hook.us1.make.com`), which writes to Google Sheets.

### Services (`src/services/`)

| File | Purpose |
|------|---------|
| `neonService.ts` | Neon PostgreSQL connection helper using `@neondatabase/serverless` — used only in Netlify Functions (not in browser) |
| `sheetsService.ts` | Client-side service: fetches student list from `get-estudiantes` Netlify Function (cached in memory), calls the Make webhook for Google Sheets backup, and provides mock local storage fallback |
| `classesService.ts` | Calls `/.netlify/functions/get-class-count` to get/increment total classes held |

### Netlify Functions (`netlify/functions/`)

All serverless functions connect to Neon PostgreSQL via `DATABASE_URL` environment variable.

| Function | Method | Purpose |
|----------|--------|---------|
| `registrar-asistencia.ts` | POST | Insert attendance record, with duplicate check |
| `get-asistencias.ts` | GET | Fetch attendance records, optionally filtered by date |
| `get-estudiantes.ts` | GET | Fetch active students from `estudiantes` table (sorted by apellido, nombre) |
| `get-statistics.ts` | GET | Aggregate daily/weekly/monthly stats and per-student counts |
| `get-class-count.ts` | GET/POST | Get or increment total classes held counter |

### Key dependencies

- **Neon PostgreSQL** (`@neondatabase/serverless` npm package) — used only inside Netlify Functions
- **Make webhook** — external automation for Google Sheets backup
- **`canvas-confetti`** — celebration effect on successful attendance
- **`framer-motion`** — page/section animations
- **`recharts`** — bar charts in TeacherPanel statistics tab
- **`@stagewise/toolbar-react`** — dev-only toolbar (dev dependency)

### Environment variables

### Database tables (Neon PostgreSQL)

| Table | Purpose |
|-------|---------|
| `estudiantes` | Enrolled students with `id`, `documento` (UNIQUE), `nombre`, `apellido`, `activo` (soft-delete), timestamps |
| `asistencias` | Attendance records with `nombre_estudiante` (text), `fecha`, `estado`, UNIQUE on `(nombre_estudiante, fecha)` |
| `configs` | Key-value config store, used for `total_classes_held` counter |

### Environment variables

`DATABASE_URL` must be set in Netlify (and locally in `.env`) for the serverless functions to work. This is the Neon PostgreSQL connection string.
