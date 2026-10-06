# Agent Guild contributor instructions

- This is a personal GitHub project. Do not use workplace Jira, Mamikos conventions, or workplace merge-request templates.
- Product requirements: `docs/product/`; current decisions and verification: `docs/implementation.md`.
- Use short-lived `feat/*`, `fix/*`, `docs/*`, or `chore/*` branches and Conventional Commits. Keep `main` buildable.
- Separate real coding-agent activity from fictional adventure and reward state. Unknown is not success; turn end is not task success.
- Keep runtime credentials and local filesystem operations in the Electron main process. Expose narrow typed preload methods.
- Preserve in-progress adventures and grant rewards idempotently. Do not award game power for token or tool-call volume.
- Run `npm run check` before committing implementation. Verify desktop behavior separately from browser/demo behavior, and document untested OS features honestly.
- Prefer original small pixel assets and a coherent visual style. Keep animations restrained and reduced-motion compatible.
