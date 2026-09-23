# HabitFlow — Habit Tracker

A production-ready, full-stack habit tracker built with **Next.js 16 (App Router)**, **Prisma + SQLite**, and **shadcn/ui**. Track habits, build streaks, visualize progress with calendar heatmaps and charts, and manage everything from a clean, responsive dashboard.

> **Architecture note:** The original spec called for a Python/FastAPI backend + separate React/Vite frontend. This implementation adapts that design to a **single Next.js 16 full-stack app** (API Routes replace FastAPI, Prisma replaces SQLAlchemy, SQLite replaces PostgreSQL) while delivering **every core feature**: JWT auth, habits CRUD with drag-reorder, check-ins, streak calculation (exactly per spec), dashboard with calendar heatmap, analytics charts, and settings.

---

## ✨ Features

### Authentication
- Email + password signup/login (bcrypt hashing)
- JWT access tokens (30 min) + refresh tokens (7 days) in **httpOnly cookies**
- Silent server-side refresh on expired access tokens
- "Remember me" controls refresh cookie lifetime
- Protected API routes + protected UI

### Habits Management
- Create habits with name, description, color (hex), icon (emoji), frequency (`daily` / `weekly` / `custom` Mon–Sun), target count, start date
- **Drag-to-reorder** (dnd-kit) with optimistic updates
- Archive / unarchive (soft delete)
- Edit and delete (with confirmation)
- Per-habit streak badges

### Daily Check-ins
- Mark a habit complete for a given date
- For `target_count > 1`, log progress (e.g. 3/8 glasses) with +/- buttons
- **Idempotent** — checking in twice on the same day updates the record
- Undo check-in (delete by date)
- `UNIQUE(habit_id, date)` constraint enforced in DB

### Streak Calculation (critical logic, implemented exactly per spec)
- `isHabitScheduled(habit, date)` — respects frequency (daily/weekly/custom) and start date
- `calculateCurrentStreak` — consecutive completed scheduled days up to today; if today is scheduled but not yet done, starts from yesterday
- `longestStreak` — max historical consecutive period
- A day counts only if `progress >= target_count`
- **Unscheduled days don't break streaks** (e.g. a Mon/Wed/Fri habit doesn't break on Tuesdays)
- Streaks cached in a `Streak` table, recalculated on every check-in

### Dashboard
- **Progress ring** showing today's completion %
- Stat cards: active streaks, best current streak, total habits, longest ever
- Today's scheduled habits with quick check-off buttons (+ / − for multi-count)
- **Month calendar heatmap** (GitHub-style) with intensity colors
- Click any day → popover showing which habits were done

### Habit Detail Page
- 90-day **GitHub-style contribution heatmap**
- Streak summary cards (current, longest, total, completion rate)
- Weekly completion bar chart (last 12 weeks)
- Day-of-week breakdown heatmap
- Recent check-ins list (scrollable)

### Analytics
- **Weekly completion** bar chart (last 12 weeks, aggregated)
- **Per-habit completion rate** horizontal bar chart (last 30 days, colored by habit)
- **Best/worst day of week** heatmap with trophy/frown indicators
- **Streak leaderboard** sorted by current streak

### Settings
- Edit name + timezone
- Toggle weekly email reminders (stored as `emailRemindersEnabled`)
- Logout (clears tokens)

### UX
- **Dark mode** (next-themes, persisted, system default)
- Responsive: sidebar on desktop, bottom nav on mobile
- Loading skeletons everywhere
- Optimistic updates on check-ins (TanStack Query)
- Toast notifications (Sonner)
- Sticky footer, accessible (ARIA labels, keyboard nav)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 (strict) |
| Database | Prisma ORM + SQLite |
| Auth | `jose` (JWT) + `bcryptjs`, httpOnly cookies |
| Server state | TanStack Query v5 |
| Forms | react-hook-form + zod |
| UI | shadcn/ui (New York), Tailwind CSS 4, Lucide icons |
| Charts | Recharts |
| Drag-drop | @dnd-kit |
| Dates | date-fns |
| Toasts | Sonner |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ / Bun
- A running dev server (already configured)

### Install & Run
```bash
# Install dependencies (already done in this environment)
bun install

# Push the database schema
bun run db:push

# (Optional) Seed demo data
bun run seed
# → Creates demo@habitflow.app / password123 with 5 habits + ~45 days of check-ins

# Start the dev server (runs on port 3000)
bun run dev
```

Open the app via the **Preview Panel** on the right (not `localhost:3000` directly — that's internal to the sandbox).

### Login
- Use the seeded demo account: `demo@habitflow.app` / `password123`
- Or register a new account from the auth screen

---

## 📁 Project Structure

```
src/
├── app/
│   ├── api/                      # Backend API routes (App Router)
│   │   ├── auth/                 # register, login, refresh, me, logout
│   │   ├── habits/               # CRUD, reorder, archive, [id]/checkins
│   │   ├── analytics/            # dashboard, calendar, completion, streaks, habit/[id]
│   │   ├── settings/             # get + patch profile
│   │   └── route.ts              # health check
│   ├── globals.css               # Tailwind + theme + custom scrollbars
│   ├── layout.tsx                # ThemeProvider + Toaster
│   └── page.tsx                  # Auth gate + page router (the only visible route)
├── lib/
│   ├── auth.ts                   # JWT (jose) + bcrypt
│   ├── session.ts                # httpOnly cookies, getCurrentUser, requireUser
│   ├── streak.ts                 # isHabitScheduled, calculateStreaks, recalculateStreak
│   ├── api.ts                    # apiOk / apiError / withErrorHandler
│   ├── db.ts                     # Prisma client
│   ├── nav-store.ts              # zustand client-side navigation
│   └── query-provider.tsx        # TanStack Query provider
├── api/client.ts                 # Typed fetch API client
├── hooks/                        # use-habits, use-checkins, use-analytics
├── types/index.ts                # Shared TS types matching backend
├── features/
│   ├── auth/                     # auth-context, auth-screen
│   ├── dashboard/                # dashboard-page (progress ring, calendar heatmap)
│   ├── habits/                   # habits-page (drag-reorder), habit-detail-page (heatmap + charts)
│   ├── analytics/                # analytics-page (4 chart cards)
│   └── settings/                 # settings-page
└── components/
    ├── ui/                       # shadcn/ui components
    └── shared/app-shell.tsx      # Sidebar + bottom nav + header
prisma/
└── schema.prisma                 # User, Session, Habit, Checkin, Streak
scripts/
└── seed.ts                       # Demo data seeder
```

---

## 📡 API Reference

All endpoints are under `/api`. Auth uses httpOnly cookies (no manual token handling needed on the client).

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | `{ email, password, name }` → sets cookies |
| POST | `/api/auth/login` | `{ email, password, remember? }` → sets cookies |
| POST | `/api/auth/refresh` | `{ refresh }` → `{ access }` |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Clears cookies |

### Habits
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/habits?include_archived=false` | List habits |
| POST | `/api/habits` | Create habit |
| GET | `/api/habits/{id}` | Get one |
| PATCH | `/api/habits/{id}` | Update |
| DELETE | `/api/habits/{id}` | Delete (cascades check-ins) |
| POST | `/api/habits/{id}/archive` | `{ archived }` toggle |
| POST | `/api/habits/reorder` | `{ ordered_ids: [] }` |

### Check-ins
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/habits/{id}/checkins` | `{ date, count?, note? }` (idempotent upsert) |
| DELETE | `/api/habits/{id}/checkins/{date}` | Undo check-in |
| GET | `/api/habits/{id}/checkins?from=&to=` | List |

### Analytics
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/dashboard` | Today's progress + streaks |
| GET | `/api/analytics/calendar?month=YYYY-MM&habit_id=?` | Month heatmap |
| GET | `/api/analytics/completion?days=90` | Weekly + per-habit + day-of-week |
| GET | `/api/analytics/streaks` | All habits' streak data |
| GET | `/api/analytics/habit/{id}` | Habit detail (90d calendar + charts) |

### Settings
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/settings` | Profile |
| PATCH | `/api/settings` | Update name/timezone/emailRemindersEnabled |

All errors return `{ detail: string, code?: string }`.

---

## 🔐 Environment Variables

Create a `.env` (already present):
```env
DATABASE_URL=file:/home/z/my-project/db/custom.db
JWT_SECRET_KEY=change-this-to-a-long-random-string-in-production
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

---

## 🧪 Streak Logic (Reference)

Implemented in `src/lib/streak.ts`, exactly per spec:

```ts
function isHabitScheduled(habit, date): boolean {
  if (date < habit.start_date) return false;
  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly") return date.weekday === habit.start_date.weekday;
  if (habit.frequency === "custom") return date.weekday in habit.custom_days;
}

function calculateCurrentStreak(habit, checkinsByDate, today): number {
  let streak = 0;
  let cursor = today;
  // If today is scheduled but not yet completed, start from yesterday
  if (isHabitScheduled(habit, cursor) && cursor not in checkinsByDate)
    cursor -= 1 day;
  while (cursor >= habit.start_date) {
    if (isHabitScheduled(habit, cursor)) {
      if (checkinsByDate[cursor] >= habit.target_count) streak += 1;
      else break;
    }
    cursor -= 1 day;
  }
  return streak;
}
```

**Note on day indexing:** The spec uses `0=Mon..6=Sun`. JS `Date.getDay()` returns `0=Sun..6=Sat`, so we convert with `(jsDay === 0 ? 6 : jsDay - 1)`. `customDays` are stored as comma-separated Mon-first indices.

---

## 🎯 Scripts

| Command | Description |
|---------|-------------|
| `bun run dev` | Start dev server (port 3000) |
| `bun run lint` | ESLint check |
| `bun run db:push` | Push Prisma schema to SQLite |
| `bun run db:generate` | Regenerate Prisma client |
| `bun run seed` | Seed demo user + habits + check-ins |

---

## 📸 Screenshots

Screenshots are saved in `tests/`:
- `tests/dashboard.png` — desktop dashboard
- `tests/analytics.png` — analytics page
- `tests/mobile-dashboard.png` — mobile responsive view

---

## 🚢 Deployment

This app is a single Next.js deployment (frontend + API routes together).

### Vercel (recommended, free tier)
1. Push this repo to GitHub
2. Import into Vercel
3. Set env vars: `DATABASE_URL`, `JWT_SECRET_KEY`, etc.
4. For production, swap SQLite for a hosted Postgres (Neon.tech free tier) by changing `prisma/schema.prisma` `provider` to `postgresql` and updating `DATABASE_URL`
5. Deploy

### Neon.tech Postgres (free)
1. Create a project at neon.tech
2. Copy the connection string
3. Set `DATABASE_URL=postgresql://...` (Prisma supports it natively)
4. Run `prisma db push` against it

### Weekly email reminders (bonus)
The `emailRemindersEnabled` setting is stored per user. A production deployment would add a cron job (e.g. Vercel Cron or Render Cron) hitting `/api/cron/weekly-reminder` every Sunday 08:00 UTC to send summary emails via Resend. In development, reminders are logged to console.

---

## 📝 License

MIT — build great habits.
