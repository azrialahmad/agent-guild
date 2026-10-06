# Coding-agent adapters

Agent Guild can receive lifecycle signals **from the process executing the session**. This matters when a desktop UI such as OpenChamber runs a private OpenCode server alongside the shared daemon: the two can see the same saved messages while only one owns the live execution.

The macOS app listens on a user-private Unix socket at `~/Library/Application Support/Agent Guild/activity.sock`. Adapters send bounded, versioned metadata: harness/producer/session identity, project basename/title, turn/tool/attention transitions, and OpenCode heartbeat snapshots. Prompts, tool arguments, output, transcripts, credentials, and full project paths are excluded from this transport. The desktop keeps the recent signals in memory. No activity signal grants XP.

Open the desktop app first, enable an adapter, then use **Settings → Find local sessions → choose the plugin/hook source → Follow this session**. **Agent activity** shows the source and last received signal. A session appears after its first observed operation, rather than claiming that an installed adapter is already tracking every saved session.

## OpenCode V2 plugin

Run `npm ci` in this checkout. The repository's `opencode.json` enables the plugin for Agent Guild development. For another project or a global setup, add the absolute path to this checkout's `integrations/opencode` directory to the existing `plugins` array in `opencode.json(c)`:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["/absolute/path/to/agent-guild/integrations/opencode"],
}
```

Preserve other plugin/config entries. The plugin runs in the actual server's location runtime, observes model-context and public lifecycle events, and sends a heartbeat snapshot every five seconds. No model request is modified. Load/reload the project's plugins through your OpenCode interface if the running session has not picked up the new configuration; do not restart an unrelated shared daemon to fix a private UI's connection.

The source label includes the producer PID and a location hash, so a private server and shared daemon remain distinct choices. The desktop marks a missing OpenCode heartbeat unknown after 20 seconds, checked every five seconds. Adapter reloads are not session success or turn completion.

Keep the `integrations` directory structure intact. The local OpenCode package uses its sibling `bridge` helper and the checkout's pinned `@opencode/plugin` dependency. Standalone npm publishing and a one-click installer are later packaging work.

### Verification

```sh
npm run verify:plugin
```

This creates a temporary project/config/session, enables the real plugin, executes a harmless session shell command, checks command → idle delivery through a real socket, and removes only its own session and directory. It sends no model prompt. Native checks passed on OpenCode **2.0.19** and OpenChamber's **2.0.15** server. Other versions require compatibility validation.

## Claude Code plugin

With a current Claude Code release supporting command-hook `args`, load the local bundle:

```sh
claude --plugin-dir /absolute/path/to/agent-guild/integrations
```

The `.claude-plugin/plugin.json` manifest selects `hooks/claude.json`. It observes session start/end, prompt submission, tool start/success/failure, permission requests, turn stop, and stop failure. It does not register model instructions, skills, MCP tools, permission decisions, or stop-continuation output.

## Codex hooks/plugin

This repository includes a local marketplace at `.agents/plugins/marketplace.json`, a portable `integrations/plugin.json`, and a compatibility `.codex-plugin/plugin.json`. In clients with local-plugin support, add this checkout as a marketplace:

```sh
codex plugin marketplace add /absolute/path/to/agent-guild
```

Install/enable **agent-guild** from **agent-guild-local** in the client's plugin interface. Use Codex `/hooks` to review and trust its bundled hook definitions; Codex skips untrusted hooks. Local-plugin installation availability varies by client.

For direct CLI configuration, merge the event groups from `hooks/codex.json` into `~/.codex/hooks.json` or a trusted project's `.codex/hooks.json`. Replace each command with an absolute checkout path, for example:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"/absolute/path/to/agent-guild/integrations/hooks/forward.mjs\" codex",
            "timeout": 1
          }
        ]
      }
    ]
  }
}
```

Include **UserPromptSubmit, PostToolUse, PermissionRequest, Stop, Interrupt, SessionStart, and SessionEnd** as well to track the complete lifecycle. Preserve existing hooks. The example above shows only the path substitution; the bundled file contains all event groups.

## Hook behavior and limits

- Requires a local Node.js executable on the harness's `PATH` (the dependency-free hook scripts support Node 18+).
- Each hook forwards one sanitized packet and exits zero, without stdout or a decision. Delivery has a 150 ms deadline; an absent companion normally fails immediately. Hook handlers have a one-second runtime timeout.
- Hooks are synchronous to retain per-tool lifecycle ordering. There is no always-running hook helper, model request, or transcript watcher. Hosted tools that Codex does not expose to hooks remain unobserved.
- Codex/Claude hooks do not continuously heartbeat. After five minutes without a signal, the desktop marks state unknown. A long quiet model request can therefore show unknown until its next hook signal. A clean stop reports turn end; a killed process cannot be inferred to have completed.
- Claude subagent tool signals have a distinct identity; a subagent stop never ends the parent turn. Only one source/session is selected for the companion.
- Hook adapters do not provide token totals. The direct OpenCode service connector remains available for its session totals.
- Input parsing, real command/stdin execution, local-socket transport, silent fail-open behavior, and desktop projection are tested. **Codex and Claude Code CLIs were not installed in the verification environment, so real-runtime loading/execution is not yet verified.**
- The initial socket transport is macOS-only. It is not a bridge to a remote/cloud agent, a competitive score authority, or a task-success evaluator.

Use `AGENT_GUILD_SOCKET` consistently in the desktop and harness environment for a custom socket. OpenCode also accepts `{ "package": "/path/to/integrations/opencode", "options": { "socket": "/custom/activity.sock" } }`. Only local lifecycle metadata crosses the socket; runtime authentication remains within the coding harness.

For a development launch that should follow a specific native session ID as soon as its adapter reports, use `AGENT_GUILD_SESSION=ses_example npm run start`. This waits for a real bridge signal, selects its source once, and is canceled by a manual source/demo selection. Ordinary launches still start in demo mode.

## Protocol and bounds

The protocol is `BridgePacket` in `src/shared/bridge-activity.ts`: schema version 1, newline-delimited JSON, one packet per connection. The main process enforces an 8 KiB packet limit, 32 simultaneous connections, at most 50 tracked source/session records, bounded tool/pending IDs, deduplication, and 80 recent events per record. Invalid/unknown versions and unexpected fields are rejected. Received-time freshness is separate from the sender's event timestamp.

## Official references

- [OpenCode V2 plugins](https://opencode.ai/v2/docs/build/plugins)
- [OpenCode V2 client/service discovery](https://opencode.ai/v2/docs/build/client)
- [Claude Code hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code plugins](https://code.claude.com/docs/en/plugins)
- [Codex hooks](https://developers.openai.com/codex/hooks/)
- [Codex plugin packaging](https://developers.openai.com/plugins/build/plugins)
