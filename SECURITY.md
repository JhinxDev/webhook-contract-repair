# Security boundaries

This is a synthetic local demonstration, not an internet-facing service. The fixture has no authentication or webhook signature check and must not be publicly deployed.

Only fixed loopback HTTP destinations are accepted by the delivery helper. Redirects are not followed. Input values and outgoing fields are validated, request bodies are bounded by the fixture, and raw payloads are not included in errors. The demo deliberately prints synthetic output for inspection. Do not replace fixtures with real customer data or secrets.

Production adaptation would require authenticated access, source signature verification, replay defence, per-client authorization, durable storage where needed, safe idempotency and operational controls. A timeout does not establish whether an upstream service performed an action. This project therefore does not retry POSTs automatically.

There are no third-party runtime dependencies. This does not imply the Node runtime or all code is free of vulnerabilities. Keep Node supported and review deployment changes separately.

For any future issue report, use sanitized reproduction steps. Do not post real credentials, customer records or account details. A private vulnerability-reporting channel has not been configured for this demonstration.
