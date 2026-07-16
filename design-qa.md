**Comparison target**

- Source visual truth: `C:\Users\Administrator\AppData\Local\Temp\codex-clipboard-077b4595-ca7d-4371-9fd3-64a35fed6b2f.png`
- Implementation evidence: live Electron window captured through Windows Graphics Capture in this task (980 × 900, 待办 / 收集箱 state).
- State: four existing tasks, first task expanded as the focus card; task input, filters, sidebar and image attachment visible.
- Full-view comparison: reviewed source and implementation at the same desktop-app state during this task. The implementation intentionally adapts the source's tall mock window to the app's resizable 980 × 900 desktop frame while preserving its left-navigation / main-focus-card / stacked-list hierarchy.
- Focused region comparison: title bar, left navigation, filter + quick capture row, focus task, and compact remaining-task rows were reviewed separately from the full view because their small typography and surface treatments materially affect fidelity.

**Findings**

No actionable P0, P1, or P2 findings remain for the requested visual adaptation.

- [P3] Window-control labels remain textual in the existing Electron shell.
  Location: top-right window controls.
  Evidence: the reference uses icon-only controls; the implementation retains `SET` and `PIN` so existing controls remain self-explanatory without adding a new icon dependency.
  Impact: minor visual drift only; no functional regression.
  Fix: replace them with a vetted packaged icon set in a later shell-polish pass.

**Required fidelity surfaces**

- Fonts and typography: display task title now uses a Songti/Georgia-style serif hierarchy; body controls remain a legible Chinese system UI face. Focus task and list rows maintain distinct optical weights without truncating controls.
- Spacing and layout rhythm: the reference's split sidebar and roomy main canvas are implemented with a 226px navigation rail, 20–24px main padding, a 12px capture surface radius, and a visibly elevated first-task focus card.
- Colors and visual tokens: warm ivory paper, charcoal ink, forest-green primary action, muted stone borders, and semantic coral/blue/amber task states map directly to the selected reference.
- Image quality and asset fidelity: generated `paper-texture.png` and `bell-mark.png` are used as raster assets for the paper surface and product mark; task attachments continue to use the user's real local images.
- Copy and content: existing Chinese task names, reminders, group actions, shortcut hints, and settings copy are preserved.
- Interactions: live verification confirmed filters switch to the empty overdue state and return to the todo list; task capture, group controls, settings and task detail controls retain their existing handlers.
- Accessibility: focus styles remain visible on the task input/title; all existing controls retain labels and keyboard behavior. The compact desktop layout has a 760px minimum width to prevent the new sidebar and task controls from colliding.

**Comparison history**

1. Implemented the warm paper visual system, wider desktop frame, left group rail, top filter/capture hierarchy, focus-card treatment for the first todo, and compact subsequent task rows.
2. Captured the live Electron window and tested filter state transitions.
3. Added and rechecked the raster bell mark so the app identity no longer uses a CSS-drawn placeholder.
4. Reworked the window shell controls with Bootstrap icon assets, moved settings into the sidebar footer, and changed group management to an add icon plus double-click rename flow.
5. Captured the live Electron window again. Verified the first focus task expands and collapses, and verified that double-clicking a non-inbox group exposes the rename field and its trash control.

**Implementation checklist**

- [x] Preserve existing task, group, reminder, attachment, settings and shortcut behavior.
- [x] Apply the selected warm paper palette and surface texture.
- [x] Move group navigation to a left-side rail.
- [x] Emphasize the first pending task as the active focus surface.
- [x] Verify tests and primary filter interaction.
- [x] Verify focus-task collapse/expand and group rename affordances.

**Follow-up polish**

- Package a unified icon set for title-bar actions if an even closer shell match is desired.

**Latest task-card update**

- Source visual truth: `C:\Users\Administrator\AppData\Local\Temp\codex-clipboard-53e39553-bf4f-421e-9582-7dc8a9be75bb.png`
- Intended state: compact task card with checkbox, two-line task information, optional single image thumbnail on the right, and a four-action horizontal rail.
- Implementation change: compact grid card with no permanent right-side action column; thumbnail renders only when the task has an attachment; quick action controls move to a bordered bottom rail.
- Implementation screenshot: unavailable in this environment after the latest Electron change.

**Latest QA status**

The latest visual comparison is blocked pending a fresh Electron-window capture at the same desktop state. Code syntax and automated reminder-parser tests pass, but they are not substitutes for visual evidence.

final result: blocked
