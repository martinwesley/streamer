# UI Redesign Plan: User-Friendly Combined Views + Large YouTube Selector

**Timestamp:** 2026-07-08  
**Target file:** app/page.tsx (main dashboard)  
**Scope:** Main authenticated UI only. Auth pages (login/register) left unchanged for now. No backend changes.

## Context from Codebase
- Current structure (app/page.tsx): Sidebar with 4 tabs (`dashboard`, `streams`, `videos`, `keys`). `activeTab` state drives conditional sections.
- Upload: File input in Videos card; auto-start already implemented (onChange calls `handleUpload(selected)`).
- Schedule form (Streams tab): Grid layout with saved-key select, video select, rtmp+key inputs, datetime, tiny inline YouTube Select (32px thumbnail).
- Broadcasts: Fetched via `/api/youtube/broadcasts` → `{id, title, thumbnail, scheduledStartTime}`. Rendered only in tiny `<Select>`.
- Lists: Scheduled streams and videos live in their tabs; stats + active streams in Dashboard.
- UX pain points: Tab switching required to upload then schedule; small YT thumbnails hard to identify; fields/lists scattered.

User request: Remodify complete UI for friendliness. Make YT broadcast selection big (thumbnails visible). Arrange fields/lists better. Combine pages where possible.

## Final Decisions (resolved via questions)
- **Navigation (3 views):** Sidebar order: Overview (LayoutDashboard icon), Schedule (Calendar icon), Stream Keys (Key icon). Remove Videos tab. Label exactly "Overview / Schedule / Stream Keys".
- **Combining:** Merge Streams + Videos into single "Schedule" view. Overview stays separate. Keys stays separate.
- **Overview enhancements:** Keep existing stats grid + Active Streams card + Network Interfaces. Add two compact mini-lists below: Recent Videos (max 3) + Upcoming Streams (max 3). Each mini-list has "Manage →" button that switches `activeTab` to "schedule". No keys in Overview.
- **Schedule view layout (stacked for flow):**
  1. Two side-by-side cards at top: "Upload Video" (dropzone + auto-on-select, no button) + "Import from URL".
  2. Prominent "Schedule Stream" card with grouped sections:
     - Video: Select + note "or upload above".
     - Destination: Saved key select (auto-fills) or manual RTMP + Stream Key inputs.
     - Schedule: datetime-local.
     - Optional YouTube: "Choose YouTube Broadcast" button (shows selected title or "None") + disconnect icon.
  3. Below form: Full-width "Scheduled Streams" table.
  4. Below that: "Uploaded Videos" table.
- **YouTube Broadcast selector (big thumbnails):**
  - Replace tiny Select with a Button: `Choose YouTube Broadcast` (shows `title` or "Select broadcast").
  - Button opens `<Dialog>`.
  - Dialog content: Search input (filters by title, case-insensitive) + responsive grid (4 cols md, 2 cols sm, 1 col xs).
  - Each card: ~180px wide, large `<Image>` (160-180px thumb), title (bold), scheduled time (small). Click card → set `broadcastId`, close dialog.
  - Footer in dialog: "Clear selection" button + "Use no broadcast".
  - When authenticated but no broadcasts: empty state message.
- **Other UX improvements:**
  - Consistent glass cards, better spacing, section headers inside Schedule form.
  - Remove old Tabs component usage for main content (keep only sidebar state).
  - Preserve existing auto-upload, polling, error toasts, mobile sidebar overlay.
  - Form submit button remains "Schedule Stream".
- **State:** All existing state variables stay (global in component). No new context needed. Add 2 new: `isBroadcastDialogOpen`, `broadcastSearch`.
- **Out of scope:** Restyle login/register; add drag-drop visuals beyond current; change API responses; persistent view prefs.

## Risks & Edge Cases
- Broadcast data may have missing thumbnails → show placeholder icon.
- Many broadcasts (>50) → grid scrolls inside dialog (use max-h + overflow).
- Mobile: Dialog + grid must be usable (already responsive tailwind).
- Switching views after selecting video/broadcast: state persists (good, intentional).
- No videos yet → Schedule video select shows empty; upload card still visible.
- Disconnect YT while dialog open → handle gracefully (close or refresh on next open).
- Timestamp formatting: keep existing `toLocaleString()` (Asia/Kolkata in lists).

## Ordered Implementation Tasks
1. Update sidebar nav array (app/page.tsx:404) to exactly 3 items: `{id:"dashboard", label:"Overview", icon:LayoutDashboard}`, `{id:"schedule", label:"Schedule", icon:Calendar}`, `{id:"keys", label:"Stream Keys", icon:Key}`. Update all `activeTab` conditionals and `setActiveTab` calls.
2. Rename `streams` tab content block to `schedule` and move the entire Videos upload+import cards + Uploaded Videos table into it (above or below the scheduled table as per layout). Delete the old `videos` conditional block.
3. Restructure Schedule content (inside the new `activeTab === "schedule"` block):
   - Top grid (2-col): Upload card (reuse current dropzone + hidden input + auto onChange logic) + Import card (keep as-is).
   - Then the existing Schedule form Card, but:
     - Add visual grouping (e.g. `<div className="border-b ...">` or separate small Cards inside).
     - Video section: keep Select, add small text "Upload more videos using the cards above".
     - YouTube section: replace current flex+Select with a single Button that sets `setIsBroadcastDialogOpen(true)`. Show selected title next to it (or "None").
4. Implement large YT selector (new code in Schedule section + top of component):
   - Add state: `const [isBroadcastDialogOpen, setIsBroadcastDialogOpen] = useState(false); const [broadcastSearch, setBroadcastSearch] = useState("");`
   - Add Dialog (reuse existing import) triggered by button.
   - Inside Dialog: `<Input placeholder="Search broadcasts..." value={broadcastSearch} onChange... />`
   - Filter: `const filteredBroadcasts = broadcasts.filter(b => b.title.toLowerCase().includes(broadcastSearch.toLowerCase()));`
   - Grid: `<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-[60vh] overflow-auto p-1">`
   - Card example (per broadcast):
     ```tsx
     <div onClick={() => { setBroadcastId(b.id); setIsBroadcastDialogOpen(false); setBroadcastSearch(""); }} className="cursor-pointer border ... rounded-xl overflow-hidden hover:border-primary">
       {b.thumbnail ? <Image src={b.thumbnail} alt="" width={180} height={100} className="w-full h-28 object-cover" /> : <div className="h-28 bg-white/10" />}
       <div className="p-3 text-sm">
         <div className="font-medium line-clamp-2">{b.title}</div>
         <div className="text-xs text-muted-foreground mt-1">{new Date(b.scheduledStartTime).toLocaleString()}</div>
       </div>
     </div>
     ```
   - Add clear actions at bottom of DialogContent.
5. Add mini lists to Overview (inside `activeTab === "dashboard"` after the 4 stat cards or after the two bottom cards):
   - Two new small Cards side-by-side or stacked:
     - "Recent Videos" – map first 3 from `videos`, show name + size or encoding badge. Button "Manage Videos" → `setActiveTab("schedule")`.
     - "Upcoming Streams" – filter pending/scheduled, first 3, show video_name + scheduled_for. Button "Manage Streams" → `setActiveTab("schedule")`.
   - Keep existing Active Streams and Network cards.
6. Move "Scheduled Streams" table directly under the Schedule form (full width Card). Move "Uploaded Videos" table after it in the same view.
7. Clean up: Remove unused `Tabs` import and any remaining `videos` tab references. Ensure `handleUpload` signature (already accepts optional File) works from the new location.
8. Minor polish inside Schedule form: Use consistent `space-y-6`, better Label descriptions, make datetime and key fields full width on mobile if needed.
9. Run validation (see below).

## Validation Steps (after changes)
- `npm run build` → must succeed with zero type errors.
- Manual flows (after `npm run dev`):
  1. Login → Overview shows stats + mini Recent Videos + Upcoming Streams.
  2. Go to Schedule → see Upload + Import cards side-by-side at top.
  3. Select a video file → upload starts automatically (progress shows), appears in Uploaded Videos list below.
  4. Pick video from select → fill destination/time → click "Choose YouTube Broadcast" → dialog opens with large searchable grid → pick one (thumbnail clearly visible) → selection reflected in button text.
  5. Submit schedule → appears in Scheduled Streams table (still in same view).
  6. Switch to Stream Keys → works unchanged.
  7. From Overview mini "Manage" buttons → correctly lands in Schedule with lists visible.
- Test: No YT connected → button shows "Connect..." flow still works. Empty lists show existing "No ..." messages. Search in YT dialog filters live.
- Responsive: Check desktop grid + mobile (sidebar + dialog).
- Regression: Existing polling, delete, schedule, import, logout unchanged.

## Files to Touch
- Only `app/page.tsx` (add ~80-120 lines for dialog + mini lists + layout changes).
- No new components unless small inline for cleanliness.
- Optional: tiny globals.css tweak for dialog grid if needed (avoid if possible).

## Open Questions
- None remaining. All decisions resolved.
- If during impl a broadcast thumbnail URL is slow/large, we can add `loading="lazy"` or fixed aspect ratio (future tweak).

Plan ready for implementation agent. After writing this file, call plan_exit.
