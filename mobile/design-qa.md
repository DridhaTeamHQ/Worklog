# Mobile design refresh

The supplied images informed the dark surfaces, soft mineral gradients, thin ring
detail, and rounded cards. Their health-product content was not copied into Taskr.

## Changes

- Shared palette, typography, corners, controls, status badges, and floating navigation.
- Member and manager dashboards with live completion, work metrics, and task shortcuts.
- Task and ticket cards, list spacing, onboarding, and sign-in.
- Dark by default for new installs; saved light/dark/system preferences still apply.

## Verification — 2026-09-05

- TypeScript: `npm run typecheck` passed.
- Expo iOS and Android exports passed. This verifies bundling, not device behavior.
- Browser review at 390 × 844 and 320 × 740; dark and light themes inspected.
- Onboarding to sign-in; empty-form validation; sign-in with isolated fixtures.
- Both role dashboards; metric-to-filter navigation; task search, empty results,
  clear filters, and task-detail navigation.
- Appearance picker and ticket-list empty state.
- No JavaScript runtime errors in the final browser pass. Existing React Native Web
  pointer-events and shadow deprecation warnings remain.

Browser checks used a temporary local fixture server, with no database or production
requests. The fixture code is outside the app and is not shipped. Real backend
integration, on-device safe areas, keyboard behavior, and native blur/haptics were
not re-tested in this design pass.

The [dashboard capture](design-preview.png) uses illustrative test data.


## Motion and real API follow-up

- Spring press feedback on gradient cards and shared buttons; native tab fades.
- Animated completion ring and integer readouts, with cancellation when unfocused
  or unmounted. Checklist rows animate into and out of the list.
- Reduced motion is observed live, including browser media preferences. Navigation,
  sheets, skeletons, toasts, and press effects respect it without remounting forms.
- Browser measurement: card press scale settles at 0.975 normally and remains 1.0
  with reduced motion. Form inputs survived a live preference change.
- Real API verified with a separate temporary SQLite database: login, manager task
  assignment through the API, member status changes, checklist add/toggle, and
  completion reflected on the dashboard after signing in again.
- Fixed dashboard task requests exceeding the server's 200-item limit.
- TypeScript and iOS/Android bundling passed again. No browser runtime errors.

The real API checks above supersede the earlier fixture-only integration limitation.
Native gesture feel, native blur, safe areas, and haptics still need a physical-device
pass. No test accounts or fixtures were added to the application's database.


## Inner-screen design pass

- Shared mineral headers now cover all secondary screens, including recovery,
  project/task/ticket forms, notifications, reports, analytics, and private notes.
- Task/ticket details use a gradient title panel with separate metadata and status
  controls. Projects have progress cards; team/profile/settings share identity cards.
- Forms group related fields; menu rows, notification cards, report cards, and empty
  states use the same spacing, borders, and icon treatment. Existing motion and
  reduced-motion handling are retained.
- Browser review covered task lists/details, assignment and ticket forms, projects,
  settings, analytics, and daily reports at phone widths (390 and 320 pixels).
  Dark and light themes checked; light-mode filter contrast corrected.
- Actual UI actions against a temporary SQLite API on port 4001: manager login,
  change task status, select assignee/project and create a task; member login,
  submit daily report, select project/task and raise a ticket, open its detail.
  The user's API on port 4000 remained untouched. Browser-only request redirection
  and test records were outside the shipped code.
- TypeScript passed; Android and iOS exports passed. No browser runtime errors.
- Native device animation feel, keyboard avoidance, safe areas, and haptics still
  require an actual-device pass.

[Inner-screen capture](inner-design-preview.png) uses isolated test data.


## Creative workflow pass

- Added a live focus deck: overdue work first, then priority and deadline; up to
  five tasks with explicit previous/next and open actions. Completed work leaves
  the deck. It reuses the existing task query and does not generate fake metrics.
- Added List/Board views for both roles. Four lanes group effective task status;
  lanes virtualize their cards, support swipe and arrow navigation, and open on
  the first populated lane. Explicit Move controls save through the existing API
  and navigate to the destination lane. Past-due items stay in Needs attention
  unless completed or their deadline changes. Boards disclose truncated results.
- Added role-specific quick actions, dot-matrix completion digits, compact board
  headers, labeled status filters, automatic selected-filter scrolling, sheet
  close buttons, and consistent white controls over dark gradient materials.
- Verified in the browser against isolated SQLite API: manager and member login,
  focus cycling/opening, manager project shortcut, member report shortcut, board
  moves in both roles, completion reflected on Home, empty search and reset,
  lane arrows, empty lanes, and all-completed state.
- Checked 390x844 and 320x740, light/dark themes, reduced-motion sheet/board behavior,
  and 100% progress at 320px. Fixed an SVG accessibility prop warning; the final
  reload had only existing RN Web deprecations and a reduced-motion dev notice.
- TypeScript and iOS/Android exports pass. Physical-device gesture feel, native
  keyboard behavior, and haptics still require a device pass.

[Creative preview](creative-design-preview.png) contains isolated test data.


## Project and workspace refinement

- Projects now open a live overview with a dot-matrix completion hero, task and
  ticket tabs, project context, and a shortcut to the filtered board. Editing has
  its own route. Fixed the project API types: detail responses omit counts, so the
  overview obtains real totals from the project summaries endpoint.
- Added a mineral workspace shortcut grid and a visual light/dark/system theme
  picker. The calendar defaults to a compact week and expands to the full month.
- Ticket details now show an explicit current-status control. Resolving opens an
  inline note form; successful saves update the status, resolution, and activity.
  Cards show severity with a small bar indicator and an accessible text label.
- Browser checked against the isolated temporary API: project overview counts,
  saving its description, About tab, project-filtered board navigation, Tickets
  tab, in-progress and resolved transitions, resolution note and activity history.
- Checked visual theme selection and calendar week/month navigation at 320px;
  Today resets the selected day, empty dates show the empty state, and dates with
  records show the actual task/ticket entries. Also reviewed project at 390px.
- TypeScript and fresh iOS/Android exports passed. Physical-device keyboard,
  safe-area, gesture, and haptic checks remain outstanding.

[Project overview preview](product-design-preview.png) uses isolated test data.


## Workspace search and daily intentions

- Added a shared workspace search route, reachable from Home and More. Tasks and
  tickets use server search and 20-result pagination; project search includes
  archived projects. Results open the existing detail routes. Category/query
  changes reset pagination and previous-query placeholders stay hidden.
- Rebuilt My Day with a live mineral progress card, All/Remaining/Done filters,
  searchable task linking, linked-task navigation, and a removal sheet. The entry
  form prevents duplicate submissions and preserves the draft on failure.
- Date changes hide previous-day placeholder records. Date navigation and note
  actions pause during mutations; toggle/delete failures roll back and show a
  toast. Notes remain private and separate from team completion metrics.
- Browser verified as a member against the isolated SQLite API: search across all
  categories, task/ticket detail navigation, no matches and clear, 21-record task
  pagination and reset on query change; note creation with task context, checkbox
  completion, Remaining/Done filters, date navigation, cancellation and confirmed
  removal. Simulated a failed note update and verified rollback plus error toast.
- Visually checked My Day in dark mode and search in light mode at 320px, plus
  390px search. The browser had no runtime errors; existing RN Web deprecation
  warnings remain. TypeScript and fresh iOS/Android exports passed.
- Physical-device keyboard, sheet gestures, safe areas, and haptics still need a
  device pass. Test records and fetch redirection were confined to temporary QA.

[Daily intentions preview](daily-design-preview.png) uses isolated test data.
