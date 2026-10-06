---
id: 01a10d0d-83e8-7eac-a6bc-f7643d7b8cb2
title: Technical Feasibility and Architecture v0.1
parent_id: 01a10d0d-5810-7e8b-8e17-24ff77328c71
space_id: 01a10d08-2709-74b8-aeb3-95305de7d00d
created: 2026-10-05T17:12:31.967Z
updated: 2026-10-06T03:21:53.134Z
---
**Date:** 2026-10-06
**Status:** Recommended technical approach; implementation and local runtime compatibility are not yet verified.

## 1. Feasibility assessment

A single-harness, single-character live macOS prototype is technically plausible. The major uncertainties are desktop overlay behavior, durable and accurate runtime-state observation, and whether a small game remains enjoyable during work.

Cross-harness support is achievable through connectors, but each integration brings maintenance and may expose different levels of detail. Cross-platform desktop behavior is also separate from sprite rendering. Neither should be treated as automatic portability.

## 2. Architecture

```text
Existing coding harness
    -> native hooks / event subscription
    -> harness-specific connector
    -> normalized activity store
        -> live character work state
        -> compact event inspector
        -> scoped activity and usage aggregates

Player input
    -> adventure state machine
    -> reward ledger and character profile
        -> character appearance / collection
        -> share-card renderer

Desktop host
    -> transparent overlay, hit testing, focus behavior
    -> tray/menu-bar controls and display placement
    -> local persistence and connector lifecycle
```

Work-state observation and game progression are separate subsystems. A fictional adventure event must not become a claimed coding event. Harness tool failures are informational inputs, not automatic game failure or XP farming opportunities.

## 3. Desktop host selection

### Recommended spike default: Electron + TypeScript

Electron is a pragmatic candidate for a web-rendered prototype with main-process local integrations and a transparent desktop window. This is a proposed starting point, not a finalized framework selection. Memory/CPU overhead and macOS window behavior must be measured.

Use React for settings, profile, and compact inspection interfaces if helpful. A small Canvas or sprite renderer can drive the character. Add PixiJS only if its sprite/animation tooling is worth the dependency; no renderer has been selected.

### Alternative to evaluate only if needed: Tauri

Tauri may suit a smaller desktop shell, but platform-specific transparency, hit testing, native APIs, and Rust integration may affect implementation effort. Avoid building two full prototypes. Use the first spike to identify whether the default host meets the requirements; investigate the alternative if it fails a concrete criterion.

### Shared versus platform-specific code

Shared: game state, sprites, event normalization, usage aggregation, share cards, most connector logic.

Platform-specific: window layering, focus, click-through regions, workspaces/full-screen behavior, display placement, notifications, startup behavior, packaging, and signing.

## 4. macOS overlay spike

Prototype one placeholder character before producing polished assets.

Test and document:

1. Transparent rendering above ordinary app windows.
2. Click-through empty space and reliable clickable character regions. Do not assume one whole-window flag solves mixed interactive/non-interactive regions.
3. Dragging/repositioning without trapping mouse or keyboard input.
4. No focus stealing from background status updates.
5. Dock position and auto-hide; reserve a configurable area rather than injecting into the Dock.
6. Mission Control, Spaces, and native full-screen applications. Publish actual supported behavior rather than promising universal visibility.
7. Multiple displays, mixed scaling, display disconnect/reconnect, and keeping the character reachable.
8. Sleep/wake and app restart.
9. Reduced motion, hide/restore controls, keyboard access to controls, and readable status labels.
10. Idle CPU, memory, animation frame rate, and battery impact. Pause unnecessary rendering when hidden.

A literal macOS Dock modification is outside the proposed approach. Characters render near a chosen desktop edge, with small props that appear and disappear.

## 5. Harness connector strategy

Each connector reports what it can observe. It does not control the user's coding task as part of gameplay.

### Capability levels

- **Basic:** observed work/turn lifecycle and attention states where supported.
- **Detailed:** tool lifecycle and tool categories.
- **Extended:** verified subagent relationships, usage accounting, historical backfill.

Capabilities are independent; a connector may support detailed tools but incomplete token accounting. The UI should not assume that choosing a harness grants every feature.

### Current documentation evidence

Documentation was consulted during planning on 2026-10-06. These findings establish candidate integration paths, not tested adapters or guaranteed support for all installed versions.

| Harness | Evidence | Consequence |
|---|---|---|
| OpenCode V2 | Official client provides local service discovery/authentication helpers and event subscriptions | Strong first candidate for an existing local session; subscriptions are live-only with no automatic replay or reconnect |
| Claude Code | Official lifecycle hooks expose prompts, tool calls/results, permission requests, stops, and subagents | Candidate hook/plugin connector; exact setup and event coverage require a local sample |
| Codex | Official hooks expose turn/tool/subagent lifecycle; app-server provides deeper streamed integration | Prefer observing the existing workflow where possible; hooks omit some hosted/specialized tool paths |
| ohmypi | Not investigated | Do not claim support or inherit assumptions from other harnesses |
| Devin and other remote agents | Not investigated | Authentication, event availability, delivery, and remote-to-local communication need separate evaluation |

### First connector recommendation

Start with OpenCode because the initial handover selected it and this is the owner's current conversation environment. Verify the owner's installed version and its matching documentation before implementation. OpenCode V2 documentation is not evidence that a V1 installation exposes the same interfaces.

Follow with whichever of Claude Code or Codex is used by actual early testers. The second connector should test the architecture rather than exist only as a marketing checkbox.

### Observe versus launch

An API that can create a new coding session is not necessarily an API that can observe an arbitrary existing session. Confirm attachment and observation behavior explicitly. Do not turn Agent Guild into a replacement coding client merely to make a connector work.

An ordinary MCP server is not automatically a global event observer. Even where lifecycle hooks can invoke MCP tools, those hooks still require harness-specific setup and coverage verification.

## 6. Activity model and correctness

This is an internal model proposal, not a published network API contract.

Preserve where available:

- Source harness, connector version, and supported runtime version.
- Session identifier; actor identifier and verified parent relationship.
- Source event identifier or deduplication key.
- Source timestamp and local receipt timestamp; source order where provided.
- Turn identifier and tool-call identifier.
- Activity kind and lifecycle phase.
- Observed outcome, without promoting turn end to task success.
- Optional source details, results, and available usage fields.
- Provenance/availability indicators for derived or missing information.

### Essential distinctions

- Session versus turn: a long-running session contains many turns.
- Independent sessions versus delegated subagents: only show parent/child relationships when reported.
- No recent event versus disconnected: silence alone is not a completion or connection-loss signal.
- Tool error versus fatal run failure: a failed tool may be followed by further work.
- Generic command versus known test run: do not label every shell invocation as testing.
- Turn ended versus task succeeded: use the former unless the source genuinely establishes an outcome.

### Concurrency and freshness

A source can run several tools concurrently. Preserve concurrent operations in the store; the compact character can display one selected activity with an indicator for additional work. Do not rewrite parallel work as an invented sequential history.

Use current state for live animation rather than making the avatar act out a growing backlog. Attention-needed signals take visual priority. Source event history remains available in the inspector even if very short activities are visually summarized.

### Recovery

- Reconnect using bounded backoff and mark connection health explicitly.
- Reconcile against available session snapshots/history after reconnect.
- If missed events cannot be recovered, show an incomplete-history gap rather than fabricating events.
- Deduplicate repeated events and avoid duplicate rewards or calendar increments.
- Filter event sources to the selected session and correct project/location.
- On sleep/wake or runtime restart, rediscover and reconcile rather than leaving a stale working animation indefinitely.

## 7. Game state and persistence

Keep character profile, inventory, active adventure, and reward history separate from the raw coding event store.

An adventure has resumable state and an explicit completion identifier. Grant rewards idempotently against that identifier so restarts or repeated event delivery cannot award the same completion twice.

Recommended local-only first release:

- Versioned local storage with migration support; evaluate SQLite as the default durable store.
- Persist adventure transitions and reward grants consistently.
- Store only the session details needed for live inspection and chosen aggregates, with an explicit retention decision before release.
- Keep profile identity independent from harness/session IDs.
- Provide a practical profile backup/export path before relying on long-term collections.

Game balancing is a configuration concern, but do not build a general game scripting engine for one encounter.

## 8. Activity, usage, and social export

- Aggregate only source-supported metrics; mark partial session coverage.
- Preserve token categories where available and avoid treating incompatible definitions as comparable totals.
- Keep coding-calendar and adventure-calendar measures explicitly labeled.
- Persist event identity and date assignment so replay/reconnect does not create new activity.
- Define local timezone/day handling and week boundaries before shipping calendars.
- Render a share image from a selected profile snapshot and selected summary fields.
- Preview exactly the fields that will be exported.
- Public posting remains a user action in the first release; no social OAuth integration is required for image downloads.

## 9. Desktop and local integration boundary

The installed application owns local runtime discovery or receives configured hooks. The renderer receives only the data and actions it needs. Keep local integration credentials in the host side rather than embedding them in downloadable demo assets.

Hook-based telemetry should return promptly and should not block coding work if the companion is closed or unavailable. Use supported asynchronous observation where appropriate, while accounting for out-of-order delivery and version-specific hook behavior.

A static public demo can illustrate the game and live-state transitions with synthetic events. It cannot universally observe local coding sessions on its own. GitHub Pages remains suitable for a demo/landing page, not the entire installed live integration.

## 10. Verification plan

Prioritize meaningful correctness checks:

- Connector fixtures for known source events, unsupported events, missing fields, and version differences.
- State transitions for tool failures, continued work, attention requests, turn end, disconnect, and recovery.
- Concurrent tools and session isolation.
- Reward idempotency and adventure resume after restart.
- Usage/calendar deduplication and timezone boundaries.
- Share export matches selected data and excludes unselected fields.
- Manual macOS desktop matrix for hit testing, focus, displays, Dock, Spaces, and full-screen behavior.

Do not spend the first iteration building a comprehensive replay engine or testing every visual frame. Verify the relationship between real events, visible state, and persistent rewards.

## 11. Future leaderboard architecture

Local-first progression and public competitive integrity are different requirements. Before adding a public ranked board, decide whether it is an explicitly self-reported community showcase or a verified competition. The latter requires an authoritative scoring/validation strategy, abuse handling, accounts, and operational ownership.

No backend stack, account system, leaderboard endpoint, or scoring contract is selected in v0.1.

## 12. Official references

- OpenCode V2 client: [https://opencode.ai/v2/docs/build/client](https://opencode.ai/v2/docs/build/client)
- Claude Code hooks: [https://code.claude.com/docs/en/hooks](https://code.claude.com/docs/en/hooks)
- Codex hooks: [https://developers.openai.com/codex/hooks](https://developers.openai.com/codex/hooks)
- Codex app-server: [https://developers.openai.com/codex/app-server](https://developers.openai.com/codex/app-server)

Read current version-matched references again when implementing a connector. This feasibility note is not a replacement for runtime samples.
