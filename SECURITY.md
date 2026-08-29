# Security Policy

## Supported Versions

MRCP Engine follows a single rolling `latest` release on npm. Security fixes are applied to the current major version.

| Version | Supported |
| ------- | --------- |
| 2.x (latest) | ✅ |
| < 2.0 | ❌ |

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Instead, report privately using one of these channels:

1. **GitHub Private Vulnerability Reporting** (preferred) — go to the [Security tab](../../security/advisories/new) of this repository and click "Report a vulnerability".
2. **Email** — [scarpatoweb@gmail.com](mailto:scarpatoweb@gmail.com) with a subject line starting with `[SECURITY]`.

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce (a minimal repo or `curl` request is ideal, since MRCP Engine's core surface is its REST/MCP API)
- Which endpoint(s) or tool(s) are affected
- Any suggested fix or mitigation, if you have one

### What to expect

- **Acknowledgment** within 72 hours of your report.
- An initial assessment (valid / not applicable / needs more info) within 7 days.
- If confirmed, a fix is prioritized and a patch release is published to npm; you'll be credited in the release notes unless you prefer to stay anonymous.
- If declined, you'll get an explanation of why.

### Scope

This policy covers the `mrcp-engine` npm package, the `api/` serverless endpoints deployed at `mrcp-engine.vercel.app`, and the `apps/vscode` extension. Given the engine executes AST parsing (and, for some tools, shell/dependency resolution) against arbitrary user-supplied repository URLs, reports involving **remote code execution, path traversal, secret/env exfiltration, or SSRF via the `repo=` / `url=` parameters** are especially high priority.

Thank you for helping keep MRCP Engine and its users safe.
