# Restoration Log — Starter Packs + Quick Start Feature

**Task IDs restored:** habit-starter-packs-v26, starter-packs-jitter-more-packs-more-templates-v27, mobile-optimization-buttons-quickstart-v32, mobile-habits-spacing-optimization-v33

**Agent:** main (orchestrator, direct implementation)
**Reason:** `git amend` operations wiped uncommitted files for these 4 tasks. Recreated below.

## Files Created

### 1. `src/lib/habit-starter-packs.ts`
- Exports `StarterPack` interface `{id, name, description, icon, color, category, habits: HabitTemplate[]}`.
- Exports `STARTER_PACKS` array with all 12 packs, each with 5 daily habits.
- Packs (in order):
  1. Morning Routine (🌅, #f59e0b, Lifestyle)
  2. Fitness (💪, #ef4444, Health)
  3. Study & Learn (📚, #8b5cf6, Learning)
  4. Mindfulness (🧘, #10b981, Mindfulness)
  5. Deep Work (🎯, #10b981, Productivity)
  6. Sleep Better (😴, #6366f1, Health)
  7. Digital Detox (📵, #ef4444, Mindfulness)
  8. Creative Practice (🎨, #ec4899, Creative)
  9. Financial Wellness (💰, #10b981, Productivity)
  10. Healthy Eating (🥗, #84cc16, Health)
  11. Social Connection (🤝, #0ea5e9, Mindfulness)
  12. Evening Wind-Down (🌙, #6366f1, Lifestyle)
- Each habit reuses the `HabitTemplate` shape (imported as `import type { HabitTemplate } from "./habit-templates"`).
- Compact `h()` helper inside the module fills in defaults (daily, no customDays, targetCount 1, category "Health") so each pack entry only specifies meaningful fields.

### 2. `src/features/habits/StarterPacksPicker.tsx`
- Dialog component. Props: `{ open, onClose }`.
- Uses `motion` from framer-motion with **`initial={false}`** on the inner containers (pack grid + detail list). This disables enter/exit animations entirely so open/close is instant with no jitter — this is the v27 jitter fix.
- Pack grid: `grid grid-cols-1 sm:grid-cols-2 gap-3` with 12 cards (icon tile + name + 5-habits badge + description).
- Pack detail view: list of the 5 habits (icon tile + name + description + frequency badge), plus an "Install pack" button.
- Install button: violet gradient (`bg-gradient-to-r from-violet-500 to-violet-600`), `Loader2` spinner when pending, `Check` icon when idle.
- Calls `templateToInput(h)` on each habit and passes the array to `useInstallStarterPack().mutate(inputs)`.
- `handleClose()` resets `selectedId` and calls parent `onClose()` — done in the close handler rather than a `useEffect` to avoid the `react-hooks/set-state-in-effect` lint error.
- Responsive padding `px-4 sm:px-6` everywhere, custom scrollbar (`custom-scroll`) on both list views.

### 3. `src/app/api/habits/batch/route.ts`
- Single `POST` handler exporting `POST`.
- Auth via `requireUser()`.
- Validates body with `z.object({ habits: habitCreateSchema.array().min(1).max(20) })`.
- Per-item custom-days validation surfaces the offending habit's index in the error message (`Habit #N: custom frequency requires at least one custom day`).
- `db.$transaction` creates all habits with sequential positions (continuing from current `_max(position) + 1`).
- `recalculateStreak` is called per habit (outside the create transaction, with `.catch(() => null)` so a streak failure doesn't roll back the batch).
- Re-fetches with `include: { streak: true }` and returns `{ habits: Habit[] }` with status **201**.
- Imports: `db` from `@/lib/db`, `requireUser` from `@/lib/session`, `apiOk, apiError` from `@/lib/api`, `recalculateStreak` from `@/lib/streak`, `habitCreateSchema, serializeHabit` from `@/lib/habit-handlers`, `z` from `"zod"`.

## Files Updated

### 4. `src/lib/habit-templates.ts`
- Added **11 new popular habit templates** before the closing `]` of `HABIT_TEMPLATES` (total is now 30 templates).
- New templates:
  - Health: `no-sugar` (🚫 #ef4444), `cold-shower` (🚿 #0ea5e9), `floss` (🦷 #0ea5e9), `skincare` (🧴 #ec4899), `cook-home` (🍳 #f59e0b)
  - Learning: `learn-skill` (🧠 #14b8a6), `vocab` (📖 #6366f1, targetCount 5)
  - Productivity: `side-project` (🚀 #8b5cf6, custom Mon-Fri `[0,1,2,3,4]`), `pomodoro-sessions` (🍅 #ef4444, targetCount 4), `tidy-up` (🧹 #14b8a6)
  - Mindfulness: `call-family` (📞 #0ea5e9, custom Mon-Fri `[0,1,2,3,4]`)

### 5. `src/lib/habit-handlers.ts`
- Exported `habitCreateSchema` (was previously `const`).
- Exported `serializeHabit` (was previously a non-exported function).
- Both are needed by the new `batch/route.ts`.

### 6. `src/api/client.ts`
- Added `batchCreateHabits(habits: HabitCreateInput[])` calling `POST /api/habits/batch` with `{ habits }` body. Returns `{ habits: Habit[] }`.

### 7. `src/hooks/use-habits.ts`
- Added `useInstallStarterPack()` hook — calls `api.batchCreateHabits`, invalidates `habits`/`dashboard`/`analytics` queries, shows a success toast `Pack installed: N habits added`.

### 8. `src/features/habits/habits-page.tsx`
- Imported `StarterPacksPicker`.
- Added `starterPacksOpen` state.
- Added **"Packs" button** in the header actions row — `size="sm"`, violet gradient outline (`bg-gradient-to-r from-violet-500/10 to-violet-500/5 border-violet-500/30`), `Sparkles` icon + "Packs" label.
- Rendered `<StarterPacksPicker open={starterPacksOpen} onClose={...} />` between the header and the existing `<TemplatePicker>`.
- **Mobile optimization (v32/v33):**
  - Container: `space-y-6` → `space-y-4 sm:space-y-6`
  - Header row: `gap-3` → `gap-2 sm:gap-3`
  - Actions row: `gap-2` → `gap-1.5 sm:gap-2`
  - Title: `text-2xl` → `text-xl sm:text-2xl`
  - Removed mobile-only subtitle "Tap a habit to view details."
  - Category filter row: `mb-3` → `mb-2`
  - "New habit" button now `size="sm"` to match the new compact mobile layout
- **Empty state** rewritten for active habits: violet gradient icon tile with `Sparkles` icon, "Start with a pack" heading, descriptive copy, primary `Browse starter packs` button (violet gradient) + secondary `Quick start` button. Archived empty state shows a "Back to active habits" button.

### 9. `src/features/habits/template-picker.tsx`
- **Mobile optimization:**
  - Template grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` → `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3`
  - Card layout: changed from vertical (icon-on-top + name/desc/freq stacked) to **horizontal** (`flex items-center gap-3` with icon tile + content column).
  - Card padding stays `p-3` (compact), `px-4 sm:px-6` for all dialog sections.
  - DialogHeader / category filter / grid / footer all use `px-4 sm:px-6` (was `px-6` only).
  - Category tabs: now `flex-nowrap overflow-x-auto` with `whitespace-nowrap` on each `TabsTrigger` so all categories stay on a single horizontally-scrollable row on mobile.
  - Icon tile: `text-3xl` → `text-2xl` (per spec).
  - Description removed from the card to keep the horizontal layout compact — the category badge + frequency label move inline next to the name.

## Lint Result
```
$ bun run lint
$ eslint .
(no output — 0 errors, 0 warnings)
```

## Verification Notes
- The `setState`-in-`useEffect` lint rule (`react-hooks/set-state-in-effect`) flagged the initial version of `StarterPacksPicker.tsx` (which reset `selectedId` in a `useEffect` watching `open`). Fixed by moving the reset into the `handleClose()` callback that's invoked synchronously when the dialog dismisses. No cascading renders.
- The `useEffect` for body-scroll-lock was also removed for the same reason — the shadcn `Dialog` primitive already locks body scroll internally via `@radix-ui/react-dialog`.
- Dev server log shows clean compiles and no runtime errors after the changes.
