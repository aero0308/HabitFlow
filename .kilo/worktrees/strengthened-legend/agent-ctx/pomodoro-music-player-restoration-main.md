# Restoration Log — Pomodoro + Music Player UI (Tasks v3-v33 restoration)

**Task IDs restored:** music-player-fixes-v3 through v11, music-player-user-isolation-v18, pomodoro-settings-fixes-v8 through v11, browser-notif-toast-guarantee-v19 through v21, mobile-optimization-v32-v33

**Agent:** main (orchestrator, direct implementation)
**Reason:** `git amend` operations wiped uncommitted files for these tasks. Recreated below.

## Files Created

### 1. `src/features/pomodoro/PlaylistOverlay.tsx`
- Large playlist overlay rendered in the main content area: `fixed top-14 bottom-0 right-0 left-0 lg:left-60 z-50 flex`.
- Backdrop (click-to-close) + right-anchored panel (`bg-popover border-l border-border shadow-2xl`, `max-w-md` on desktop, full-width on mobile).
- Header: ListMusic icon + "Playlist" title + track count + "Add track" button (UploadCloud) + X close.
- Now-playing card above the list: violet play/pause button + "NOW PLAYING" label + current track title/artist + duration.
- Upload progress shown as a spinner + progress bar (violet gradient) at the top of the track list whenever `uploadProgress !== null`.
- Track list: scrollable (`flex-1 overflow-y-auto custom-scroll min-h-0`), each row has a now-playing animated equalizer OR a play icon OR the index number; title/artist; lock badge (built-in) or trash button (uploads); duration.
- Built-in tracks use `isDefaultTrack()` and show a Lock badge — they can't be deleted.
- Body scroll locked while open (cleanup on close). Esc closes.
- All motion.divs use `initial={false}` so open/close is instant with no jitter.
- `handleFileUpload` accepts multiple files, iterates them, calls `uploadTrack` per file with try/catch + toast.
- Uses store: `playlistOpen`, `setPlaylistOpen`, `playlist`, `currentTrackIndex`, `isPlaying`, `durations`, `selectTrack`, `removeTrack`, `uploadTrack`, `uploadProgress`, `setPlaying`.

### 2. `src/features/pomodoro/FocusMusicManager.tsx`
- Renders a hidden `<audio ref className="sr-only" preload="auto">` element.
- Watches `usePomodoroStore` for `mode`, `status`, `endTime`, `settings.musicWhileFocusing` AND `useMusicStore` for `volume`.
- When `musicWhileFocusing && mode==="focus" && status==="running"`:
  - Picks a random lofi track from `["/audio/midnight-reverie.mp3", "/audio/soft-focus.mp3", "/audio/deep-work.mp3"]`.
  - Sets `audio.loop = true` and `audio.src = trackUrl`, calls `audio.play()` (caught silently if blocked).
- When conditions become false: pauses audio.
- Uses refs: `sessionTrackUrl` (the picked track for the current session), `lastSessionStartRef` (the `endTime` of the current session). A new session (`endTime` changes) triggers a fresh random pick; pause/resume of the same session keeps the same track.
- Volume applied from `useMusicStore.volume` via a separate effect.
- Cleanup effect pauses audio on unmount.
- Separate from the MusicPlayer's interactive audio so background music can't interfere with manual playlist selection.

### 3. `src/features/pomodoro/AuthMusicSync.tsx`
- Returns `null` — invisible bridge component.
- Uses `useAuth()` to get `user`. Subscribes to `setActiveUser` from the store.
- `useEffect` on `[user?.id, setActiveUser]`: calls `useMusicStore.getState().setActiveUser(user?.id ?? null)`.
- On logout (`!user?.id`): iterates `document.querySelectorAll("audio")` and pauses + resets `currentTime = 0` on each (so the FocusMusicManager + MusicPlayer audio elements both stop).

## Files Updated

### 4. `src/components/shared/app-shell.tsx`
- Added imports: `PlaylistOverlay`, `FocusMusicManager`, `AuthMusicSync` (all from `@/features/pomodoro/`).
- Rendered all three after `<MobilePomodoroFab />` at the end of the root div so they're globally mounted (PlaylistOverlay is `position: fixed`, so it overlays the main content area; the other two are invisible/auxiliary).

### 5. `src/features/pomodoro/pomodoroStore.ts`
- Added `musicWhileFocusing: boolean` to the `PomodoroSettings` interface.
- Added `musicWhileFocusing: false` to `DEFAULT_SETTINGS`.
- Bumped the persist storage key from `habitflow-pomodoro-v5` → `habitflow-pomodoro-v6` so previously persisted state without the new field doesn't hydrate as `undefined` (which would crash the FocusMusicManager).

### 6. `src/features/pomodoro/PomodoroSettings.tsx`
- 4th ToggleRow added in the Notifications tab: `label="Music while focusing"`, `checked={settings.musicWhileFocusing}`, `onChange={(v) => updateSettings({ musicWhileFocusing: v })}`.
- Outer `motion.div` panel animation: replaced `initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ type: "spring", stiffness: 400, damping: 35 }}` with just `initial={false}` — instant open/close, no jitter. (The inner tab crossfade / stepper view animations are kept since they're wrapped in `AnimatePresence mode="wait"` for the tab swap.)
- Light-mode fixes:
  - Settings `<h3>` heading: added `text-foreground` (was uncolored).
  - Duration row value: `text-xs text-white font-medium` → `text-xs text-foreground font-medium`.
  - Stepper big number: `text-3xl font-mono tabular-nums font-bold text-white` → `text-3xl font-mono tabular-nums font-bold text-foreground`.

### 7. `src/features/pomodoro/MusicPlayer.tsx`
- Removed `PlaylistModal` import and the `<PlaylistModal>` render at the bottom of the file (it was calling the non-existent `addTrack` action — broken). The local `playlistOpen`/`setPlaylistOpen` React state was also removed.
- Now reads `playlistOpen` and `setPlaylistOpen` directly from `useMusicStore`, so the global `PlaylistOverlay` (rendered in app-shell) and this button stay in sync.
- Playlist button uses `aria-pressed={playlistOpen}` for active state and gets a `bg-primary text-primary-foreground border-primary` look when active vs `bg-muted border-border text-muted-foreground hover:bg-accent` when inactive.
- The actual playlist opening is done via `setPlaylistOpen(true)` (the PlaylistOverlay at app-shell level reads `playlistOpen` from the store and renders itself).
- Verified the rest already matches spec: volume bar fill anchored at bottom (`bg-primary`), volume dropdown click-outside handler via `volumeWrapRef` + `mousedown` listener (already present from a previous restoration).
- Deleted `src/features/pomodoro/PlaylistModal.tsx` entirely — it referenced the non-existent `addTrack` store action and was superseded by `PlaylistOverlay`.

### 8. `src/features/pomodoro/MusicPlayerControls.tsx`
- Verified spec — already matches: `text-muted-foreground` for non-active shuffle/prev/next/repeat, `text-foreground` for hover, `text-white` kept on the violet play/pause button, `ring-1 ring-background` on the repeat indicator dot. No changes needed.

### 9. `src/features/pomodoro/SpectrumBars.tsx`
- Verified spec — already matches: container uses `bg-muted/40`. No changes needed.

### 10. `src/features/pomodoro/PomodoroTimer.tsx`
- Crossfade between timer and music views is now via `<AnimatePresence mode="wait">` wrapping BOTH `motion.div`s.
- Timer view (key="timer") and Music view (key="music") both use:
  - `initial={{ opacity: 0, y: 8 }}`
  - `animate={{ opacity: 1, y: 0 }}`
  - `exit={{ opacity: 0, y: -8 }}`
  - `transition={{ duration: 0.18, ease: "easeOut" }}`
- Music button (top-left of ring): unchanged light-mode classes `border-border bg-muted hover:bg-accent text-muted-foreground hover:text-foreground`.
- Inactive session dots: `hsl(var(--muted-foreground) / 0.25)` (already in place).
- Primary action button: changed from `flex-1 h-8 ... bg-primary hover:bg-primary/90 text-primary-foreground` to `flex-1 h-7 mx-1.5 ... bg-muted-foreground/20 hover:bg-muted-foreground/30 text-foreground` (smaller height, narrower via horizontal margin, greyer background).
- Controls row now has a fixed `h-8` on the container.

### 11. `src/features/pomodoro/PomodoroTickIndicators.tsx`
- Verified spec — already matches: inactive dot color is `hsl(var(--muted-foreground) / 0.2)` and the className fallback is `bg-muted-foreground/20`. No changes needed.

### 12. `src/features/settings/settings-page.tsx`
- Added `Calendar` to the lucide-react import list.
- **Email reminders section** — replaced the previous inline hint + test button with:
  - A "Sending to: {user.email}" row (Mail icon + label + value).
  - A "Next email: Monday 09:00 UTC" row (Calendar icon + label + static value).
  - The "Send test email" button.
- **`handleTestEmail` rewritten** to call `fetch("/api/emails/test-weekly-summary", { method: "POST", credentials: "include" })` directly (the API client's `sendTestReminder` helper is no longer used here). Response shape `{ ok, dev, sample, messageId, email }`. Toast logic is three-way:
  - `data.dev === true` → "Test email logged to console" (mentions recipient email).
  - `data.sample === true` → "Sample email sent" (mentions recipient email + "(Sample data was used.)").
  - Otherwise → "Test email sent!" (mentions recipient email).
  - Rate-limit / non-OK responses surface the `data.detail` error message via `toast.error`.
- **Browser notifications section** — reorganized into three state-aware blocks (the toggle itself unchanged; "Blocked" badge already inline in the title):
  - `ON + granted`: "Remind me at [time picker]" + "Test notification" button. (Time picker keeps the existing `reminderTime` mutation.)
  - `ON + default`: hint text + an explicit "Enable notifications" button that calls the new `handleRequestNotificationPermission` helper (which calls `Notification.requestPermission()`, updates local `notifPermission` state, and shows a success/denied toast).
  - `ON + denied`: static "Browser notifications are blocked..." message.
- `onBrowserReminderToggle` already requests permission when turning ON with permission=default AND calls `updateMut.mutate({ browserRemindersEnabled: v })` — kept unchanged (matches spec).
- Removed: the previous "In development mode..." hint copy, the duplicated "Test notification" button (now only one), and the "Click 'Test notification' or reload..." amber hint (replaced with the explicit Enable-notifications button).

### 13. `src/features/pomodoro/musicStore.ts`
- Fixed a parser-breaking type on `reconcileUploads` — the `set` parameter's union type was missing a closing paren (`Partial<MusicState> | ((s: MusicState) => Partial<MusicState>) => void` should have been `Partial<MusicState> | ((s: MusicState) => Partial<MusicState>)`). The ESLint TypeScript parser was failing at column 133 with "Parsing error: ',' expected", and the dev server's SWC compile was emitting `Parsing ecmascript source code failed` on the home route. Adding the missing `)` fixed both.

## Lint Result
```
$ bun run lint
$ eslint .
(no output — 0 errors, 0 warnings)
```

## Verification Notes
- Before the musicStore.ts type fix: dev.log showed 8x `Parsing ecmascript source code failed` and `GET / 500 in 335ms (compile: 326ms, render: 9ms)`.
- After the fix: `✓ Compiled in 195ms`, then `GET / 200 in 670ms` followed by a cascade of 200s for all data endpoints (dashboard, weekly-summary, weekly-review, moods, achievements, off-modes, calendar, music/uploads) and `POST /api/auth/logout 200`.
- `GET /api/music/uploads 200 in 517ms (compile: 480ms, render: 37ms)` confirms the music store's `fetchUserUploads()` reconcile path is firing on app load (AuthMusicSync → `setActiveUser` → loads uploads).
- Final `GET / 200 in 45ms (compile: 4ms, render: 40ms)` after all the new files were saved — no compile errors from any of the new components.
- The pre-existing `examples/` and `skills/` TypeScript errors (socket.io, etc.) are not in scope and were not touched.
- The pre-existing `src/features/settings/settings-page.tsx` TS errors about `avatarUrl`/`browserRemindersEnabled`/`firstName`/`reminderTime` not existing on the narrow `Partial<{ name; timezone; emailRemindersEnabled }>` mutation body type are pre-existing — the same code pattern exists in the original file (those `.mutate({...})` calls all predate this restoration). ESLint doesn't flag them (the mutation function param is typed loosely enough to accept the extra keys at lint time), and the runtime behavior is correct because the underlying `api.updateSettings` handler accepts all those keys.
