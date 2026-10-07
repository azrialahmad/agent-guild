# Desktop prototype — implementation and verification

Repository: [azrialahmad/agent-guild](https://github.com/azrialahmad/agent-guild). The initial prototype merged in PR #1. Background/reconnect work uses `feat/background-and-reconnect`, targeting `main` through a pull request. Commits follow Conventional Commits.

## Implemented scope

This build implements the first live macOS slice of the Docmost PRD, with a small set of sharing features.

- Electron host; React + TypeScript guild panel; original Canvas pixel art.
- Startup creates only the companion and menu-bar lantern. The guild panel is created by an explicit open action and destroyed on close, releasing its renderer. Game state and tracking live in the main process.
- Compact 520 × 620 utility panel (minimum 420 × 500), replacing the 1080 × 800 dashboard. Three primary tabs, header activity/settings/share shortcuts, and a single companion/status view.
- On macOS, a hidden native title bar places the original traffic lights within the warm app header. Reserved left padding keeps content clear of the controls; the header is draggable and status/action controls are explicitly non-draggable. There is one visible guild title.
- Adventure history and signal explanations use native expandable disclosures. Secondary pages scroll inside the panel; navigation remains available. The default companion screen fits without scrolling.
- Transparent 260 × 190 desktop-edge overlay, non-focusable, floating above regular windows.
- Per-pixel sprite hit testing requests native click-through for empty areas. Visible status and controls are interactive regions.
- Menu-bar lantern, hide/restore, captured pointer drags, display-work-area clamping, position reset, and saved placement.
- Character opens My guild; sparkle opens Adventures directly. Explicit overlay actions restore minimized panels and bring the panel forward.
- OpenCode V2 local-service discovery and authentication through the official client, pinned to 2.0.19.
- Executing-server OpenCode plugin plus experimental Codex/Claude Code command-hook bundles. A user-private Unix socket carries sanitized, bounded lifecycle packets to the existing Electron main process.
- Source identity and last received signal are visible; source/session combinations remain distinct even when two OpenCode servers share saved conversations.
- A separate atomic, versioned `connection.json` remembers harness/transport, native session ID/title, and a stable hashed bridge source identity. It stores no runtime credentials or event history and does not alter the game profile.
- Ordinary restart waits for a fresh matching bridge signal, or rediscovers/retries the saved shared-service session. Unknown is retained while connecting, disconnected, or ambiguous; the app does not silently switch sources or revert a saved selection to demo. Explicit demo selection clears the preference.
- OpenCode source identity survives PID changes using an executable/location hash; separate overlapping producers remain visible. Two fresh producers with the same stable identity require explicit selection. Legacy packets fall back to their producer identity; reloading the updated adapter enables PID-independent recovery.
- Settings shows remembered connection/status and opens the adapter guide through a fixed native external-link method.
- One selected root session. Multiple sessions can be selected individually; simultaneous multi-character parties are not implemented.
- Live tool/execution, permission, form, and session-shell events; concurrent operations are retained.
- Reconnect with bounded backoff, snapshot reconciliation, live-only recent event inspector, and explicit disconnected state. Missed event history is not invented.
- Sleep stops the direct-service stream and resume reconnects to the selected service session. Bridge sources recover through their next adapter signal.
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
integrations/   Executing-server OpenCode plugin and Codex/Claude lifecycle hooks
docs/product/   Snapshots fetched from Docmost
```

Credentials remain in the main process. The app does not issue model prompts or reply to permission requests. Connecting a session is observational. Live event details may contain private source information, so the in-memory inspector is separate from exported postcards.

## Verification performed

Development environment: macOS on Apple Silicon, OpenCode 2.0.19, Node.js 22 portable toolchain. The computer's global Node installation was not replaced.

Results: `npm run check` passed with 16 domain tests. The 6 native Electron cases passed against the source build and the packaged Apple Silicon `.app` (the source navigation case was rerun after correcting an automation-helper race). Static browser-demo production compilation also passed. The disposable direct-connector check previously passed against OpenCode 2.0.19; the real-plugin bridge check previously passed against both 2.0.19 and OpenChamber's 2.0.15 server. The updated plugin and packaged plugin/service restart recovery were checked against the real 2.0.19 service.

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
- Shared-database activity newer than the shared server's idle marker is unknown until its execution source is confirmed.
- Actual command-hook stdin → socket delivery is sanitized; an absent companion produces no output/decision and exits zero.
- Concurrent bridge tools/attention, duplicate suppression, stale-source recovery, strict packet parsing, and live socket ownership are checked.
- Connection preference serialization rejects extra/private fields and invalid identities, preserves corrupt files, and can be explicitly replaced or cleared. Explicit harness session end disconnects rather than implying a successful outcome.

### Native Electron checks

- Start with no panel, create one on demand, play, close mid-adventure, and reopen to complete it and equip an unlocked cloak. The original panel renderer PID disappears from Electron's process metrics.
- Generate an actual PNG postcard preview; unavailable token option stays disabled.
- Escape dismisses the native HTML dialog.
- Overlay is always-on-top and non-focusable.
- An empty rendered pixel has zero alpha (not just an opaque background with a matching color).
- Hide/restore updates the native companion and saved state.
- Repositioning and reset change native window bounds correctly.
- Sparkle selects Adventures from a minimized panel; character selects My guild from a hidden panel and focuses it.
- A pointer-driven grip drag changes native bounds and persists the new position to the profile file.
- A selected private-server plugin source drives editing/attention/turn-end states and exposes source metadata. Observed tools and turn end leave XP and rewards unchanged.
- Compact native window dimensions and the no-scroll default companion view are asserted. Adventure history expands on demand; adventures, wardrobe unlocks, and postcard export still work at the smaller size.
- The integrated macOS header was checked at 420/520/800-pixel widths, including Claude Code and disconnected labels: content avoids the reserved native-control area and has no horizontal overflow. Header drag regions exclude action/status controls, native traffic-light position is retained, and content fills the full window height. Physical title-bar dragging still needs a hands-on pass.
- Restart the app with an isolated persisted bridge choice: wrong harness/source/session signals are ignored, a changed producer PID with the same stable identity reconnects, overlapping producers stay unknown until explicitly chosen, and source end can recover to the remaining matching runtime.
- Tracking continues with the panel destroyed. Rewards remain unchanged throughout recovery. Choosing demo clears disk preferences and remains demo on the next restart. A missing saved service session stays disconnected/unknown while preserving its preference for retry.

These checks exercise an actual Electron application rather than browser-only mocks. The source and packaged build are checked separately before delivery.

The compact layout was also inspected in the synthetic browser demo at 375/1440-pixel widths, with reduced motion enabled. All five pages have no horizontal overflow, the adapter guide opens, and adventure progress survives reload. Browser/demo validation is separate from native overlay behavior.

### Short resource baseline

Measured on Apple Silicon macOS using the packaged Electron 40.10.6 application. `npm run measure:desktop` launches a fresh, uninstrumented app with a disposable profile for each window mode, waits four seconds, and records ten approximately one-second samples. It verifies whether windows exist, not just whether they are visible. `ps` supplies cumulative CPU time and RSS for the main process and its descendants. CPU percentages use the convention **100% = one fully occupied core**, rather than Electron's normalized share of all logical cores.

Current bridge + on-demand-panel build, measured 2026-10-07:

| Demo window mode              | Mean CPU (one-core %) | Mean summed RSS | Processes |
| ----------------------------- | --------------------: | --------------: | --------: |
| Panel + companion             |                 2.03% |         405 MiB |         5 |
| Companion only, no panel made |                 1.83% |         346 MiB |         4 |
| Panel opened, then destroyed  |                 1.74% |         321 MiB |         4 |
| Tray only, no panel made      |                 0.58% |         303 MiB |         4 |

The panel-closed scenario opens the panel and closes it after one second, before sampling. Lower RSS than the never-opened scenario is a short residency observation, not evidence that opening a panel improves memory. The reliable structural change is one fewer renderer/process when the panel is absent. Each scenario is a fresh app launch, not an all-day trend.

Historical pre-bridge build, measured 2026-10-06 (both windows existed in every mode, with hidden panel renderers retained):

| Demo window mode  | Mean CPU (one-core %) | Mean summed RSS | Processes |
| ----------------- | --------------------: | --------------: | --------: |
| Panel + companion |                 2.12% |         454 MiB |         5 |
| Companion only    |                 1.84% |         437 MiB |         5 |
| Tray only         |                 0.87% |         424 MiB |         5 |

The packaged `.app` occupies approximately 330 MiB on disk. RSS sums include shared pages and omit compressed/GPU allocations, so they are not a unique physical-memory footprint. Earlier snapshots of a longer-running instance were around 215 MiB; memory residency changes with time and system pressure. These short synthetic-demo samples do not establish sustained live-session CPU, memory stability, or battery impact.

Playwright launches disable normal Chromium background throttling, so its initial exploratory resource samples are unsuitable for this baseline. The measurement command uses normal native launches, verifies which windows are visible, and removes only its own temporary profiles. To measure the packaged build:

```sh
AGENT_GUILD_EXECUTABLE="$PWD/release/mac-arm64/Agent Guild.app/Contents/MacOS/Agent Guild" npm run measure:desktop
```

Avoidable work removed: the static landscape has no animation clock; the companion paints directly without a React state update per frame, stops its clock while hidden or reduced-motion is active, and caches alpha pixels after painting instead of reading the canvas on each mouse move. Native windows use a genuinely hidden initial visibility state. Drag position saves are debounced for 200 ms and flushed on normal quit.

The current build removes the unnecessary panel renderer and remains CPU-light in the short demo sample. Electron still has a moderate memory footprint. Next performance work should measure sustained live-session memory trends and battery use during a real workday.

### Real OpenCode checks

- Authenticated service discovery, session listing, message snapshots, pending permissions/forms, and selected-session usage accounting.
- Event subscription to the actual local V2 server.
- Disposable session shell execution: observed `session.shell.started` and `session.shell.ended`, command animation state, then idle. No model prompt was needed.
- The script cleans up only its own session and temporary directory.
- `verify:plugin` loads the actual plugin in an isolated project on both 2.0.19 and 2.0.15, then observes real shell start/end through the Unix socket and a return to idle. It sends no model prompt.
- The actual conversation was then observed through the private-server plugin: working/reading/tool transitions arrived. The rebuilt packaged app followed this exact session, displayed the plugin source, and showed the currently executing command. This verifies ongoing real model-loop activity; full prompt-to-stop lifecycle coverage across each harness remains a separate runtime check.
- Updated packaged-app recovery check on 2.0.19: create a disposable project with the real adapter, observe shell events, select its stable source, restart the desktop, and receive the plugin's next heartbeat without a panel. Further real shell signals arrive. Select the same real session through the direct connector, restart again, and restore its authenticated service connection. XP stays zero. Only the check's own project/session/profile are removed.

### Tracking incident and adapter decision

The initial connector discovered the shared 2.0.19 service. This conversation was actually executing on OpenChamber's private 2.0.15 server. Both could read the current saved messages, but the shared service had no active execution and emitted no relevant live events. The private server and OpenChamber's authoritative session status reported running/busy. The old projection also suppressed saved running tools when the shared active map was empty, resulting in a misleading “No active turn.”

The plugin now reports from the executing location runtime, while the direct connector identifies its shared-service source and treats newer saved activity without execution confirmation as unknown. The plugin observes model-context hooks and selected public lifecycle events without modifying requests. Five-second snapshots restore state after a companion restart; source loss becomes unknown after 20 seconds (checked every five seconds).

Codex and Claude adapters are local plugin/hook bundles that forward allowlisted lifecycle metadata and return no decisions. Their real stdin/command/socket behavior and desktop state mapping are tested; **their CLIs were not installed here, so native plugin loading and full agent-loop coverage remain unverified**. Hook-only sources expire after five quiet minutes and do not expose token totals. A long silent model request can therefore show unknown. No transcript scraping or task-success inference is used.

Setup and protocol bounds are in [`integrations/README.md`](../integrations/README.md). The optional `AGENT_GUILD_SESSION` launch setting overrides the saved selection while waiting and remembers a source only after it emits the requested session ID. Ordinary launches restore the saved source; first launch or explicit demo selection uses demo. User adventures, unlocks, rewards, and profile serialization are independent of all bridge records.

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
| Short packaged-demo CPU and process-tree RSS                | Measured above; fresh launches, ten samples per mode                            |
| Battery/CPU under all-day use                               | Not yet measured                                                                |
| Intel macOS                                                 | Build configuration permits it; native testing was Apple Silicon                |
| Windows/Linux                                               | Not validated or advertised as supported                                        |

## Current limitations and next experiments

The three routes share one memory mechanic. This is enough to test the loop, not evidence that the content will retain users for weeks. Petting is expressive and does not award grindable XP. Passive XP is currently zero; progression comes from actively completing adventures.

Selection recovery is limited to the remembered native session and source, rather than choosing a newer conversation automatically. Hook-only sources must send another lifecycle event after desktop restart. Moving a project or executable can change its stable hash and require reselection. Adapters loaded before this update use legacy producer identity until reloaded. A one-click adapter installer and standalone adapter publishing remain future work.

The event inspector keeps the most recent 80 relevant events from this connection in memory. Direct-service event detail is capped at 6,000 characters; bridge events contain only the allowlisted lifecycle metadata from bounded packets. It is not a complete session debugger. Direct reconnect snapshots inspect the most recent 30 messages; this is a bounded recovery window, not a full historical replay.

The first calendar is **adventure activity**, not a coding contribution graph. Token totals are available through the direct OpenCode service connector; the plugin/hook bridge does not currently forward usage. Cross-session coding calendars, ranking, production-ready additional harness connectors, and animated share clips remain roadmap work.

The local profile is user-editable, so shared progression is a personal showcase rather than a verified competitive score. The public leaderboard remains a separate design and infrastructure decision.

Packaging creates an unsigned development `.app`; a signed/notarized public release has not been set up. Optional native serialization acceleration is not rebuilt during packaging; the app uses the supported JavaScript path and the packaged artifact is smoke tested.

## Product experiments next

1. Leave the companion visible during several workdays and note hiding/repositioning frequency.
2. Test the adventure repeatedly and decide whether memory play is genuinely enjoyable.
3. Record whether it replaces phone pickup or adds an interruption.
4. Verify manual desktop matrix before widening platform support.
5. Validate the experimental Codex/Claude adapters in their actual runtimes and prioritize improvements from early-user demand.
