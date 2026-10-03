# Verification record

Checked October 3, 2026 on Windows, Node 24.15.0.

| Check | Result |
| --- | --- |
| Lockfile generation | Successful offline; zero third-party packages |
| `npm run check` | Passed |
| `npm test` | 17 tests passed, zero failures |
| `npm run demo` | Observed HTTP 422 before repair and HTTP 201 after repair |
| Real transport | Temporary loopback HTTP server and fetch client |
| External API/model calls | None |
| GitHub Actions | Prepared, not executed |
| Linux/macOS | Not locally tested |
| Client runtime or vendor integration | Not tested |

Local tests required permission for loopback network access. No account credentials were required. No production readiness, security certification or independently diagnosed client bug is claimed. The source was authored and reviewed with AI assistance; owner understanding and publication review are separate.

The workflow uses pinned commits from the official [checkout](https://github.com/actions/checkout) and [setup-node](https://github.com/actions/setup-node) repositories, read from their v7 tags on the verification date. Review action updates deliberately. The workflow has read-only repository permissions, disables persisted checkout credentials and does not publish packages or deploy services.
