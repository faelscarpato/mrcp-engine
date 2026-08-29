# Contributing to MRCP Engine

First off, thank you for considering contributing — deterministic tooling like this gets better with more languages, more edge cases, and more real-world repos thrown at it.

## Ways to contribute

- **Bug reports** — something returned wrong data, crashed, or timed out
- **Feature requests** — a new tool, a new language grammar, a new output format
- **Documentation** — typos, unclear setup steps, missing examples, translations
- **Code** — bug fixes, new Tree-sitter grammar integrations, new analysis tools
- **Real-world testing** — running the full suite against your own repos and reporting what breaks

You don't need to write code to contribute meaningfully. Filing a precise, reproducible bug report is just as valuable.

## Before you start

For anything beyond a small fix (typo, one-line bug), please open an issue first to discuss the approach. This avoids duplicated work and makes sure a PR has a clear path to being merged.

## Development setup

```bash
git clone https://github.com/faelscarpato/mrcp-engine.git
cd mrcp-engine
pnpm install
```

Common scripts:

```bash
pnpm dev              # start the dev server
pnpm build             # production build
pnpm test              # run the test suite (Vitest)
pnpm lint               # ESLint
pnpm format            # Prettier
pnpm build:grammar <name>   # compile a Tree-sitter grammar to WASM (e.g. sap-cds, oracle-plsql)
pnpm build:grammar --all    # compile all grammars
```

This is a pnpm workspace (`packages/*`, `apps/*`, `api`) — always install and run scripts from the repo root unless you're intentionally scoping to one workspace with `pnpm --filter <name>`.

## Adding a new Tree-sitter grammar / language

1. Add the grammar dependency in the relevant `packages/` workspace.
2. Wire it into the WASM build pipeline (`scripts/build-grammar.mjs`).
3. Run `pnpm build:grammar <your-language>` and confirm the `.wasm` output.
4. Add at least one fixture repo/file exercising the new grammar in the test suite.
5. Update the language list in `README.md` **and** `README.pt-BR.md`.

## Adding a new analysis tool

Every tool in the catalog follows the same contract: deterministic input → deterministic JSON output, no LLM calls inside the tool itself. When proposing a new one:

- Describe the JSON shape it returns
- Add both the MCP tool definition and the matching REST endpoint
- Add it to the relevant category table in both README files
- Include a test with a small fixture repo

## Pull request checklist

- [ ] `pnpm lint` and `pnpm test` pass locally
- [ ] New/changed behavior has a test
- [ ] Public API changes are reflected in `README.md`, `README.pt-BR.md`, and `CHANGELOG.md`
- [ ] Commit messages are clear about **what** changed and **why**
- [ ] PR description explains the motivation, not just the diff

Fill out the PR template — it's short on purpose.

## Commit style

Conventional, short, imperative:

```
fix: correct hotspot threshold in code-health scorer
feat: add mrcp_dependency_compatibility_resolver
docs: translate CONTRIBUTING to pt-BR
```

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) — the more reproducible (a public repo URL, the exact endpoint/tool called, expected vs. actual JSON), the faster it gets fixed.

## Reporting security issues

**Do not open a public issue for security vulnerabilities.** See [SECURITY.md](SECURITY.md) for the private disclosure process.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Participation implies agreement to those terms.

## Questions?

Open a [discussion or issue](../../issues) — there's no such thing as a question too small.
