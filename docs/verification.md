# Verification record

## Version 0.2.0 replay lab

Checked October 3, 2026 on Windows with Node 24.15.0: syntax checks passed; 29 tests passed (17 existing plus 12 replay tests); original HTTP demo passed; all four expected/actual process-exit lab scenarios matched. Tests require loopback permission. No test was bypassed. For hosted verification, use the workflow run matching the release commit, linked in its release notes; the original run below verifies only v0.1.0.

The lab starts no public receiver and performs no external API calls. See [reproduction and limits](replay-lab.md). Package version is 0.2.0. The existing v0.1.0 tag and assets remain available unchanged. Release assets include the exact source archive, SHA256 file and a manifest identifying source and verification.

## Original v0.1.0 verification

Checked October 3, 2026 on Windows, Node 24.15.0.

| Check | Result |
| --- | --- |
| Lockfile generation | Successful offline; zero third-party packages |
| `npm run check` | Passed |
| `npm test` | 17 tests passed, zero failures |
| `npm run demo` | Observed HTTP 422 before repair and HTTP 201 after repair |
| Real transport | Temporary loopback HTTP server and fetch client |
| External API/model calls | None |
| GitHub Actions | Windows and Ubuntu jobs passed |
| Linux/macOS | Ubuntu verified in CI; macOS untested |
| Client runtime or vendor integration | Not tested |

Local tests required permission for loopback network access. No account credentials were required. No production readiness, security certification or independently diagnosed client bug is claimed. The source was authored and reviewed with AI assistance; owner understanding and publication review are separate.

The workflow uses pinned commits from the official [checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node) repositories, read from their v7 tags on the verification date. Review action updates deliberately. The workflow has read-only repository permissions, disables persisted checkout credentials and does not publish packages or deploy services.

Hosted acceptance evidence: [successful Windows and Ubuntu run](https://github.com/JhinxDev/webhook-contract-repair/actions/runs/37103400617). This run verifies the initial source release; the README badge tracks subsequent revisions.
