---
name: Bug report
about: Something returned wrong data, crashed, or timed out
title: "[BUG] "
labels: bug
assignees: ""
---

**Describe the bug**
A clear, concise description of what went wrong.

**Which tool or endpoint?**
e.g. `mrcp_security_compliance_audit` / `GET /api/security-audit?repo=...`

**How you called it**

- [ ] MCP (via IDE/agent) — which client: <!-- Claude Desktop, Cursor, Windsurf, VS Code, etc. -->
- [ ] REST API directly (`curl`, HTTP client)
- [ ] VS Code / Cursor / Windsurf extension

**Repository or input used**
<!-- A public repo URL is ideal — MRCP's analysis is deterministic, so a public repo lets us reproduce exactly. If the repo is private, a minimal reproducible fixture (even 2-3 files) works too. -->

**Expected result**
What you expected the JSON/response to contain.

**Actual result**
What you actually got — paste the raw JSON response or error if possible.

**Environment**

- MRCP Engine version: <!-- `npx mrcp-engine --version` or the npm version installed -->
- Node.js version:
- OS:
- Hosted instance (`mrcp-engine.vercel.app`) or self-hosted?

**Additional context**
Anything else — timing (did it time out?), repo size, language(s) involved, etc.
