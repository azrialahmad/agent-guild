---
id: 01a10d0d-5810-7e8b-8e17-24ff77328c71
title: Agent Guild — PRD v0.1
parent_id: None
space_id: 01a10d08-2709-74b8-aeb3-95305de7d00d
created: 2026-10-05T17:12:20.728Z
updated: 2026-10-05T17:13:13.411Z
---
**Owner:** Azrial
**Date:** 2026-10-06
**Status:** Consolidated product baseline for prototyping. User-confirmed direction is distinguished from recommended defaults; balancing and implementation choices remain testable.
**Project state:** Concept and documentation only. No application repository, implementation, assets, or verified connector has been created as part of this planning work.

## 1. Product summary

Agent Guild is a macOS-first desktop companion and lightweight game for people who use AI coding agents. Cozy, anime-inspired pixel characters work along the desktop edge, visibly reflecting real agent activity. During a wait, users can play short character interactions and micro-adventures, develop a persistent character, and share their progression and optional coding-agent activity statistics.

**Pitch:** Your coding agent, brought to life on your desktop—with little adventures while you wait.

The characters live on a transparent desktop overlay, rather than inside a permanently visible rectangular workshop. Temporary props communicate activity. The overlay remains available when the user switches away from the coding harness.

Agent Guild should support both personal expression and a sense of achievement. Character customization, collections, levels, activity cards, and eventual competition are complementary motivations, not an assumption that one alone will ensure retention.

## 2. Problem and opportunity

Waiting for an agent creates a gap in attention. Azrial reports that he often reaches for his phone within the first 60 seconds of waiting. This describes the onset of distraction, not a verified average agent-task duration.

Existing text interfaces can communicate execution details, but may not remain visible when users switch to other work. Agent Guild combines peripheral awareness with optional, short play that can occupy some of those waiting moments.

The intended behavioral benefit is to reduce reflexive phone scrolling during agent downtime. Reduced total screen time is not established and must not be claimed without evidence. The game could instead become another distraction; the prototype must test that possibility.

## 3. Audience

### Initial audience

- Developers using a local coding-agent harness on macOS.
- People who enjoy pixel art, character collecting, cozy games, and visible progress.
- Users comfortable installing a desktop utility and connecting a supported harness.

Azrial is the first daily-use tester. He normally uses one agent session, works on macOS, and also uses Windows personally.

### Expansion audience

- Users with multiple independent coding sessions.
- Windows users, followed by Linux users.
- Users of additional local harnesses and, where integration permits, remote agent services.

Claims that most developers use Macs or multiple simultaneous agents are unvalidated. The platform sequence is justified by the owner's workflow and ability to test, not a quantified market-share claim.

## 4. Goals and non-goals

### Goals

1. Make supported live coding-agent activity understandable from a small desktop-edge character.
2. Offer enjoyable short interactions that preserve work continuity.
3. Give active players meaningfully greater progression and collection opportunities than passive observers.
4. Build attachment through persistent characters, customization, and adventure history.
5. Make progression easy to share through attractive exported images, with optional supported usage statistics.
6. Establish a maintainable route to additional harnesses and desktop platforms.
7. Produce a distinctive open-source personal project with a strong public demo and GitHub presentation.

### Not in the first release

- Replacing the user's coding harness or becoming a full IDE.
- Universal harness compatibility or identical detail across integrations.
- A full historical replay/debugger with arbitrary seeking.
- A fully featured RPG, large crafting economy, multiplayer world, or real-money rewards.
- Public ranked leaderboards and account infrastructure before the game and scoring are validated.
- Reliable estimates of percentage task completion or coding productivity derived from token consumption.

These scope boundaries are recommended delivery defaults, not a rejection of the longer-term social and competitive direction.

## 5. Confirmed product decisions

| Topic | Decision |
|---|---|
| Core mode | Live companion; imported replay is no longer the central MVP |
| Placement | Always-on-top, transparent desktop-edge characters; no persistent boxed workshop |
| Art | Cozy, anime-inspired pixel art with readable, expressive characters |
| Interaction | Mix of character play and micro-adventures, not passive animation alone |
| Progression | Active engagement should earn more than passive presence |
| Social motivation | Both unique identity/collections and visible achievement/competition matter |
| Sharing | Shareable progression; usage statistics and activity-calendar concepts are desired |
| Platform order | macOS, then Windows, then Linux |
| Personal workflow | Usually one session; leave an expansion path for several |
| Project context | Personal, GitHub-only development; no workplace Jira or MR conventions |

## 6. Experience principles

### Peripheral by default, interactive by choice

The character is glanceable during other work. Interactions are opt-in. Working animations should be restrained, with an easy way to hide or reduce motion.

### Easy to leave

Adventure state saves when the user disengages. A real attention-needed signal interrupts decorative activity promptly. No reward is lost because the user returns to coding.

### Real work and fiction stay distinguishable

The work animation reflects supported runtime events. Adventure stories, item drops, and character levels are fictional game state. A monster encounter is not evidence of a code failure. Ending a turn is not proof of task success.

### Small visual footprint

Characters stay in a user-positioned working area along an edge. Props appear only when useful. Empty overlay space passes clicks through. Interactive elements do not block unrelated work.

### Persistent identity

The same character, equipment, discoveries, and history persist across sessions and harnesses. The coding runtime is an activity source, not the owner of the user's game identity.

## 7. Core loops

### Work-awareness loop

1. User installs Agent Guild and connects a supported local harness.
2. User selects a live session and submits work in their usual coding interface.
3. The character changes activity based on observed events.
4. User can switch to another application and retain peripheral awareness.
5. When the source reports that attention is needed or the turn has ended, the character clearly signals it.
6. User returns to their coding interface; a direct return action is offered only where supported.

### Play-and-progression loop

1. While the agent works, a small optional interaction or encounter is available.
2. User plays a brief segment involving a choice or a simple skill action.
3. The result grants a persistent game reward, such as adventure XP, a discovery, or a cosmetic.
4. User equips, collects, or displays the reward.
5. Future visits build on this persistent identity and unlock further variety.

The exact encounter is not selected. A small creature encounter with a choice and collectible keepsake is a candidate prototype, not a finalized design. Target interactions of roughly 5–30 seconds are a design hypothesis; longer encounters should be segmented and resumable.

### Social loop

1. User reaches a milestone or creates a distinctive character combination.
2. User previews an exported guild card.
3. User chooses which identity, game, and usage details to include.
4. User downloads and voluntarily shares the image.
5. The card provides a recognizable project name and optional project link, allowing others to find the demo.

A downloaded card is not proof that it was shared publicly. Analytics and reporting must preserve that distinction.

## 8. Progression and competition

### Requirements

- Active play must provide meaningfully more game progression than merely leaving the application open.
- Progression must have visible consequences: equipment, companions, titles, encounter unlocks, or character expression.
- A level number alone is insufficient as the core reward.
- Persistent progress survives app restarts and agent-session changes.
- The system supports both personal collection/showcase and future competitive features.

### Recommended first balancing direction

- Use adventure completion and interaction outcomes as the main active reward inputs.
- Keep passive progression modest; its exact existence, rate, and unlocks are a prototype decision.
- Do not directly convert tokens, tool-call counts, or elapsed runtime into spendable game power. This is a recommended policy to avoid making expensive or inefficient agent runs the winning strategy.
- Reward finite interactions with clear endings rather than indefinite rapid clicking.
- Do not penalize switching back to work, missing a day, or dismissing an encounter.
- Do not allow an interaction to issue coding commands or modify the real task as a game effect.

Exact XP rates, drop probabilities, level curves, rarity tiers, daily limits, and economies are explicitly undecided. Do not implement a large balancing system before the first encounter is tested.

### Competitive direction

The user wants both expression and comparative achievement. The first release expresses achievement through levels, personal records, collections, and exported cards. A later leaderboard is an explicit roadmap item, not a discarded concept.

Before shipping a public board, define its audience, score, reset cadence, eligibility, and integrity expectations. A local save is editable and cannot substantiate a verified competitive ranking. A token-consumption board, if pursued, must be described as consumption rather than coding quality and must use comparable accounting definitions.

## 9. Functional requirements

### P0 — first usable live prototype

| ID | Requirement | Acceptance condition |
|---|---|---|
| LIVE-1 | Connect to one supported harness and select one session | Real observed events update the selected character without replacing the coding interface |
| LIVE-2 | Show working, attention-needed, turn-ended, and unknown/disconnected states | Disconnect or missing data never becomes a false completion or success signal |
| LIVE-3 | Map available tool activity to readable animations | User can inspect the source event behind a work-state change |
| DESK-1 | Transparent always-on-top desktop-edge rendering on macOS | Character is visible over tested ordinary app windows; empty space remains click-through |
| DESK-2 | Position, hide, and restore the character | Controls remain reachable and placement remains on a usable display |
| DESK-3 | Avoid unwanted focus changes | Normal runtime updates do not steal keyboard focus |
| GAME-1 | One character interaction and one micro-adventure loop | A tester can play, leave midway, resume, and receive a persisted reward |
| GAME-2 | Active progression | Completing an interaction produces a visible reward beyond passive observation |
| DATA-1 | Local persistence | Character, adventure progress, and rewards survive restart without duplicate grants |
| ACCESS-1 | Reduced motion and accessible controls | Status remains understandable without relying only on animation or color |

### P1 — first shareable release

| ID | Requirement | Acceptance condition |
|---|---|---|
| SHARE-1 | Export a guild card as an image | Preview matches the download and includes the selected character/milestone |
| SHARE-2 | Optional activity and usage fields | User can omit metrics; unavailable metrics show as unavailable, not zero |
| PROFILE-1 | Simple character customization and collection view | Equipped choices persist and appear on the overlay and card |
| ACTIVITY-1 | Contribution-style activity calendar | Legend states whether cells represent coding sessions or game activity and how days are counted |
| DEMO-1 | Immediate synthetic demo | Prospective users can see the concept without connecting a real session; demo is labeled |
| CONNECT-2 | Validate a second harness | Shared model works with an independently implemented connector before claiming broad portability |
| RELEASE-1 | GitHub launch materials | README, supported-version notes, install steps, screenshots, known limitations, and feedback route exist |

P1 is a delivery phase, not a requirement to build all features before testing P0. Additional harness support may ship after the initial public macOS release if integration work would postpone behavioral validation.

### Later

- Public leaderboards or opt-in friend comparisons.
- Additional encounter content, companions, and equipment.
- Multiple independently selected sessions and verified subagent visualization.
- Windows, then Linux distribution.
- Animated GIF/video share exports.
- Rich historical replay, aggregate histories, and additional remote integrations.

## 10. Activity and usage display

- Distinguish coding activity from gameplay activity; do not merge them into a vaguely labeled productivity score.
- A calendar uses a documented local-day convention. Timezone changes and duplicate events must not create duplicate activity or rewards.
- Usage fields may include token counts when directly available, with input/output/cache categories where the source provides them.
- Every usage summary states its scope, such as selected session or supported recorded sessions this week.
- Unknown or incomplete coverage is explicit. No inferred billable cost without a supported pricing/accounting model.
- Different harnesses may expose different metrics. The visual companion remains useful without full usage accounting.
- The default share card emphasizes the character and game milestone. Source code, prompts, paths, and raw tool output are excluded unless a future feature intentionally supports user-selected inclusion.

## 11. Initial user journeys

### First session

Install → see labeled demo → connect supported harness → select session → position character → submit a task normally → observe activity → try one encounter → see saved reward.

### Working in another application

Start agent task → switch to another application → character stays in its configured area → ignore optional play → see attention signal → return to harness.

### Distracted waiting

Start agent task → choose a brief encounter before reaching for phone → interact → stop immediately when needed → resume later without losing progress.

### Sharing

Open character/profile view → select milestone → preview guild card → choose optional statistics → export image → share using existing social applications.

## 12. Validation and success criteria

Do not optimize for total game minutes. The product aims to be enjoyable while remaining easy to leave.

### Prototype questions

1. Does the owner voluntarily leave the overlay visible across several workdays?
2. Does the character communicate real state more conveniently than checking the harness?
3. Is the encounter enjoyable after repeated exposure, without needing an elaborate reward economy?
4. Can users return immediately when the agent needs attention?
5. Does optional play replace any phone scrolling, or simply add distraction?
6. Do testers care about their persistent character or want to export a card?

### Measurement plan

- Begin with owner testing and a recommended small cohort of roughly 5–10 willing users; this is a recruitment target, not an existing group.
- Use a short baseline diary of waiting and phone pickup, followed by the same diary with the companion. Treat self-reports as directional, not causal proof.
- Record voluntary return, frequency of hiding the overlay, encounter starts/completions, exported cards, and reported interruptions where users agree to measurement.
- Measure attention-state delivery from connector receipt to visible UI; set a provisional target of under one second in local test conditions. Source-side delivery delay is measured separately.
- Track loss/duplication of progression and incorrect connection states as reliability failures.
- Choose broader retention targets after initial observations; do not fabricate a benchmark or claim product-market fit from a small sample.

### Go/no-go checkpoints

- If the overlay routinely obstructs work, revise desktop behavior before adding content.
- If the encounter is not enjoyable, iterate the interaction before adding leaderboards or XP complexity.
- If users primarily want status awareness, simplify the game.
- If users primarily want the game and ignore real activity, revisit positioning rather than claiming a focus benefit.

## 13. Distribution and commercial scope

- Personal open-source project developed on GitHub.
- Public demo and repository support discovery; installed application provides live desktop integration.
- Start with macOS; Windows and Linux are sequential expansion stages.
- No business model, paid currency, subscription, or real-money reward system has been selected.
- Desktop signing/notarization and distribution method are release decisions to investigate, not assumed completed setup.

## 14. Related planning documents

Companion documents in this space cover technical feasibility, the prototype roadmap, and the decision register. Together they form a v0.1 implementation brief. They intentionally preserve a small set of prototype decisions rather than requiring another long interview before work can begin.
