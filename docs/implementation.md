# Desktop prototype — implementation and verification

Repository: [azrialahmad/agent-guild](https://github.com/azrialahmad/agent-guild). Initial implementation branch: `feat/desktop-mvp`, targeting `main` through a pull request. Commits follow Conventional Commits.

## Implemented scope

This build implements the first live macOS slice of the Docmost PRD, with a small set of sharing features.

- Electron host; React + TypeScript guild panel; original Canvas pixel art.
- Transparent 260 × 190 desktop-edge overlay, non-focusable, floating above regular windows.
- Per-pixel sprite hit testing requests native click-through for empty areas. Visible status and controls are interactive regions.
- Menu-bar lantern, hide/restore, drag movement, display-work-area clamping, position reset, and saved placement.
- OpenCode V2 local-service discovery and authentication through the official client, pinned to 2.0.19.
- One selected root session. Multiple sessions can be selected individually; simultaneous multi-character parties are not implemented.
- Live tool/execution, permission, form, and session-shell events; concurrent operations are retained.
- Reconnect with bounded backoff, snapshot reconciliation, live-only recent event inspector, and explicit disconnected state. Missed event history is not invented.
- Sleep stops the stream and resume reconnects to the selected session.
- Three variants of one short, resumable memory-trail mechanic; mistakes reset the current trail without losing saved rewards.
- 40 XP per completed adventure; one level per 100 XP. Four cloaks and a fox cosmetic.
- Pet interaction, local name customization, reduced-motion preference.
- Atomic versioned JSON profile rather than SQLite: one small profile document keeps completion ledger, rewards, and adventure state together.
- PNG guild-card export with preview, optional adventure calendar, optional selected-session input/output tokens, and no source content.
- Profile backup export; manual restoration instructions in README.
- Synthetic browser demo and desktop demo, both clearly labeled.

## Repository structure

```text
src/main/       Native windows, persistence, local runtime connection, narrow IPC handlers
src/preload/    Typed, context-isolated bridge
src/shared/     Activity model, OpenCode projection, game state and validation
src/renderer/   Guild UI, overlay, original art, share-image renderer
tests/unit/     State correctness, reward idempotency, save recovery, display placement
tests/desktop/  Actual Electron UI flows and native window checks
scripts/        Real-runtime verification and original app-icon generation
docs/product/   Snapshots fetched from Docmost
```

Credentials remain in the main process. The app does not issue model prompts or reply to permission requests. Connecting a session is observational. Live event details may contain private source information, so the in-memory inspector is separate from exported postcards.

## Verification performed

Development environment: macOS on Apple Silicon, OpenCode 2.0.19, Node.js 22 portable toolchain. The computer's global Node installation was not replaced.

Results: `npm run check` passed with 9 domain tests. The 2 native Electron tests passed against the source build and again against the packaged Apple Silicon `.app`. Static browser-demo production compilation also passed. The disposable real-runtime connector check passed against OpenCode 2.0.19.

### Automated domain checks

- Partial adventure survives serialization/reload and can complete.
- Re-delivered completion does not duplicate XP or calendar entries.
- Incomplete adventures cannot collect rewards; mistakes preserve the encounter.
- Cosmetic unlock eligibility is enforced.
- Corrupt saves are rejected without overwriting the existing file.
- Parallel tools retain correct activity after one fails; failed tools do not end the entire task.
- Multiple attention requests retain priority until each is resolved.
- Other sessions and duplicate events are filtered.
- Disconnect is unknown, followed by snapshot reconciliation without fictional history.
- Display clamping handles negative display coordinates and removed monitors.

### Native Electron checks

- Start and play a real rendered UI, reload mid-adventure, complete it, and equip an unlocked cloak.
- Generate an actual PNG postcard preview; unavailable token option stays disabled.
- Escape dismisses the native HTML dialog.
- Overlay is always-on-top and non-focusable.
- An empty rendered pixel has zero alpha (not just an opaque background with a matching color).
- Hide/restore updates the native companion and saved state.
- Repositioning and reset change native window bounds correctly.

These checks exercise an actual Electron application rather than browser-only mocks. The source and packaged build are checked separately before delivery.

### Real OpenCode checks

- Authenticated service discovery, session listing, message snapshots, pending permissions/forms, and selected-session usage accounting.
- Event subscription to the actual local V2 server.
- Disposable session shell execution: observed `session.shell.started` and `session.shell.ended`, command animation state, then idle. No model prompt was needed.
- The script cleans up only its own session and temporary directory.

## Native behavior requiring manual validation

| Behavior                                                    | Status                                                                          |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Transparent content and native floating/non-focusable flags | Automated verification                                                          |
| Hide/restore, native movement, position reset               | Automated verification                                                          |
| Mixed transparent/interactive OS mouse routing              | Implemented; physical mouse behavior still requires hands-on verification       |
| Overlay presence in native full-screen Spaces               | Configured; not asserted across arbitrary applications                          |
| Mission Control                                             | Not yet manually validated                                                      |
| Dock auto-hide and all Dock placements                      | Work-area placement implemented; actual user configurations need manual testing |
| Multi-display bounds and removed-display recovery           | Placement logic tested; physical mixed-DPI setup not validated                  |
| Sleep/wake                                                  | Recovery handlers implemented; real sleep cycle not validated                   |
| Battery/CPU under all-day use                               | Not measured                                                                    |
| Intel macOS                                                 | Build configuration permits it; native testing was Apple Silicon                |
| Windows/Linux                                               | Not validated or advertised as supported                                        |

## Current limitations and next experiments

The three routes share one memory mechanic. This is enough to test the loop, not evidence that the content will retain users for weeks. Petting is expressive and does not award grindable XP. Passive XP is currently zero; progression comes from actively completing adventures.

The selected session is not restored automatically on app restart; the app begins in demo mode. This avoids falsely claiming an old connection is live. A later onboarding/reconnect preference can add persisted selection with explicit connection state.

The event inspector keeps the most recent 80 relevant events from this connection in memory, with source detail capped at 6,000 characters per event. It is not a complete session debugger. Reconnect snapshots inspect the most recent 30 messages; this is a bounded recovery window, not a full historical replay.

The first calendar is **adventure activity**, not a coding contribution graph. Token totals are available for the selected OpenCode session. Cross-session coding calendars, ranking, other harness connectors, and animated share clips remain roadmap work.

The local profile is user-editable, so shared progression is a personal showcase rather than a verified competitive score. The public leaderboard remains a separate design and infrastructure decision.

Packaging creates an unsigned development `.app`; a signed/notarized public release has not been set up. Optional native serialization acceleration is not rebuilt during packaging; the app uses the supported JavaScript path and the packaged artifact is smoke tested.

## Product experiments next

1. Leave the companion visible during several workdays and note hiding/repositioning frequency.
2. Test the adventure repeatedly and decide whether memory play is genuinely enjoyable.
3. Record whether it replaces phone pickup or adds an interruption.
4. Verify manual desktop matrix before widening platform support.
5. Choose a second connector from actual early-user demand.
