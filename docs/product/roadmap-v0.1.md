---
id: 01a10d0d-8384-72d9-a5ea-5ba6477d095c
title: Prototype Roadmap and Decision Register v0.1
parent_id: 01a10d0d-5810-7e8b-8e17-24ff77328c71
space_id: 01a10d08-2709-74b8-aeb3-95305de7d00d
created: 2026-10-05T17:12:31.865Z
updated: 2026-10-06T03:21:52.455Z
---
**Date:** 2026-10-06
**Status:** Actionable implementation sequence with explicit assumptions. No further brainstorming interview is required to begin the prototype.

## 1. Delivery sequence

### Stage 0 — Establish the personal project

- Confirm a new destination repository/directory before writing application code; none was chosen in the planning conversation.
- Use GitHub for code and issues, and this Docmost space for product documentation.
- Do not reuse or modify the GitHub profile repository or portfolio as application source.
- Obtain a sanitized runtime-event sample from the selected installed harness.
- Record runtime version, OS version, and development setup.

**Exit:** An isolated project exists with a small sample fixture and clear prototype goals.

### Stage 1 — Prove the desktop surface

- Create a transparent macOS overlay with one placeholder sprite.
- Implement click-through empty space, clickable character interaction, positioning, hide/restore, and no focus stealing.
- Test ordinary windows, Dock behavior, multiple displays, Spaces, and full-screen applications.
- Record unsupported behaviors and resource usage.

**Exit:** The owner can leave the character present while doing normal work without routinely fighting the overlay. If this fails, revise the shell/window approach before investing in art.

### Stage 2 — Connect real work

- Implement one source connector, recommended OpenCode after version verification.
- Select one live session and display observed working, attention-needed, turn-ended, and unknown states.
- Add a compact event inspector and provenance for work animations.
- Handle reconnect, sleep/wake, and source-state reconciliation.

**Exit:** A real session drives the character without changing where the user writes prompts, and missing events are not represented as successful work.

### Stage 3 — Prove one enjoyable loop

- Add a persistent character profile.
- Build one brief character interaction and one resumable micro-adventure, sharing as much art and UI as possible.
- Grant visible active-play rewards with idempotent persistence.
- Test repeated use before adding several currencies or a large content tree.
- Test that real attention signals remain visible and the player can immediately return to work.

**Exit:** The owner enjoys repeated encounters across several work sessions and voluntarily returns. If only rewards are appealing, improve the interaction before expanding progression.

### Stage 4 — First shareable macOS release

- Add a small but coherent set of customization choices.
- Export a character/progression image with optional supported usage summary.
- Add a precisely labeled activity calendar if the collected data supports it reliably.
- Provide a synthetic public demo, install instructions, supported-version matrix, and feedback route.
- Choose signing/notarization and release distribution approach.
- Recruit a small early-user cohort; collect return, interruption, and phone-scrolling feedback without claiming causal proof.

**Exit:** New users can install, connect, play, resume, and export a card without developer assistance in the documented supported environment.

### Stage 5 — Validate breadth and competition

- Implement a second connector selected from real tester demand; this may move earlier if it is inexpensive and useful for architecture validation.
- Validate multiple independent sessions separately from subagents.
- Test whether users prefer collection showcases, friend comparisons, or ranked competition.
- Define a leaderboard score and trust model before implementing public rankings.
- Add encounters based on observed repetition/fatigue, rather than speculative content volume.

**Exit:** Compatibility and competitive features have evidence of demand and explicit maintenance requirements.

### Stage 6 — Platform expansion

- Windows after the macOS interaction is validated.
- Linux afterward, with explicit desktop environment/display-server support notes.
- Share renderer and game logic; independently validate desktop behavior on each platform.

No calendar deadlines or effort estimates are committed. The overlay and first integration spikes should supply the evidence for a realistic schedule.

## 2. Decision register

### User-confirmed

| Decision | Rationale from the conversation |
|---|---|
| Live-first | The product should help during the actual wait |
| Transparent desktop characters | User wants characters working on screen without an isolated boxed space |
| Always-on-top direction | Users should see activity while doing other work |
| macOS, then Windows, then Linux | Owner's work platform and preferred release priority |
| Character play plus adventures | Passive animation alone would not hold the owner's attention |
| Active engagement earns more | Progression should favor people who participate |
| Sharing and progression matter | User values levels, achievements, usage sharing, and activity visualization |
| Both identity and competition | Unique character/collection and comparative achievement are both desired |
| Personal GitHub project | No workplace process integrations |

### Recommended defaults adopted for planning, not represented as explicit user approval

| Default | Reason | Revisit when |
|---|---|---|
| One selected live session first | Matches owner's usual workflow and keeps prototype legible | Early testers demonstrate concurrent-session demand |
| OpenCode first | Initial handover direction and available current environment | Installed-version evidence or tester access suggests another connector |
| Electron/TypeScript overlay spike | Fast route to web-rendered desktop proof | Concrete overlay or resource constraints fail |
| Local profile storage | Enables early persistent play without account infrastructure | Sync or public competition becomes a validated requirement |
| Cards and personal milestones before public leaderboard | Tests sharing without premature scoring/backend work | Users demonstrate demand for comparison and a score is defined |
| No direct token-to-power conversion | Separates consumption from winning the game | A different reward design can justify its incentives |
| Modest or no passive XP pending testing | User confirmed active rewards, not a specific passive system | First encounter is playable and balancing can be observed |
| Short resumable play | Fits fragmented waiting and return-to-work goal | Real sessions show a different interaction need |
| Characters near the Dock, not Dock modification | Preserves the requested appearance with a testable overlay | Prototype reveals placement problems |

### Open questions for prototypes rather than another interview

1. Which concrete micro-adventure remains enjoyable after repeated plays?
2. What amount of passive progression, if any, complements active rewards?
3. Which visible reward creates the strongest attachment: outfit, companion, tool, or title?
4. How much room and motion can the overlay use before it becomes distracting?
5. Which macOS full-screen/Spaces behaviors are achievable and worth supporting?
6. Which token fields and calendar definitions are reliable for the selected runtime?
7. What score would make competition enjoyable without merely measuring spend or time online?
8. Does play reduce reflexive scrolling or become another source of interruption?

These are not all blockers. The prototype should answer them in order of dependency.

## 3. Main risks and responses

| Risk | Evidence to gather | Response |
|---|---|---|
| Novelty fades | Repeated-use feedback and voluntary returns | Improve the core interaction before adding reward layers |
| Overlay obstructs work | Hiding/repositioning frequency and desktop tests | Reduce footprint, motion, and interactive regions |
| Game distracts from real work | Reported interruption and attention-response observations | Shorten encounters, save immediately, prioritize real attention state |
| Connectors misrepresent work | Captured source fixtures and lifecycle edge cases | Capability-based display and explicit unknown/gap states |
| Cross-harness maintenance dominates | Breakage and onboarding effort across second connector | Publish version support and expand based on demand |
| Local progression undermines rankings | Assess intended competition trust model | Use personal showcase initially; design authoritative ranking separately |
| Art/content scope grows too quickly | Repetition feedback from the first encounter | Reuse a coherent small asset set; add content in response to evidence |

## 4. First implementation handoff

Use the following brief when starting a coding session:

> Build the first technical slice of Agent Guild using the PRD, technical feasibility plan, and roadmap in the Agent Guild Docmost space. This is a personal GitHub project. Confirm a new repository/directory before writing code. Start with a macOS transparent desktop-edge overlay containing one placeholder character, clickable character interaction, click-through empty space, hide/restore controls, and no focus stealing. Validate Dock, display, Spaces, and full-screen behavior and document limitations. Then verify the installed OpenCode version and a sanitized event sample before implementing one live-session connector. Keep real agent activity separate from fictional game/adventure progression. Do not start with a full RPG, public leaderboard backend, broad platform support, or historical replay engine. Proposed defaults are testable, not proof that any specific framework or runtime behavior is already verified.

## 5. Definition of the current documentation milestone

The product direction is sufficiently specified to prototype. Exact game balance, final artwork, leaderboard score, and desktop framework are intentionally not frozen. Update this decision register when experiments resolve them so later implementation agents can distinguish user intent from discarded assumptions.
