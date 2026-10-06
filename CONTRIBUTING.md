# Contributing

Start with the product snapshots in `docs/product`. Keep changes focused and open a pull request against `main`.

## Branches

- `feat/<short-description>` — new functionality
- `fix/<short-description>` — bug fixes
- `docs/<short-description>` — documentation
- `chore/<short-description>` — tooling and maintenance

## Commits

Use `type(scope): imperative description`. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `perf`, `build`, `ci`, `chore`. Example: `fix(connector): reconcile state after reconnect`.

Run `npm run check` before submitting implementation. Describe how changes were verified and which native behaviors need manual testing. Do not commit raw private sessions, runtime credentials, or user profiles.
