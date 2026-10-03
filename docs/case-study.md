# From rejected payload to accepted request

## Scenario

An order webhook carries fields under `body.order`. The receiving API expects a flat object with identifiers, integer quantity, integer cents and currency. The seeded mapper reads from the top level, so its undefined properties disappear during JSON serialization. The destination rejects the resulting `{}` with HTTP 422.

The mismatch is visible before changing code: inspect the incoming shape, write the expected destination object, and compare the emitted request. “The API is broken” is too broad a diagnosis; the actual issue in this example is the transformation between contracts.

## Repair

The replacement validates the envelope, IDs, quantity, price and currency, then creates an explicit five-field output. Price parsing uses whole and fractional digits instead of floating-point multiplication. Customer email and internal notes stay out of the destination payload.

The old mapper stays under fixtures to reproduce the failure. The repaired implementation lives under src. Tests drive a separate destination validator, including an actual HTTP request, so success requires agreement with the receiving contract rather than just calling the new function.

## Verification

The regression sequence verifies rejection of the old mapping, no accepted record after that failure, acceptance of the repaired mapping, and the exact stored output. Additional cases test ambiguous input, privacy-related field exclusion and bounded transport failures. See [verification](verification.md).

## Transfer to client work

A real engagement would start with a sanitized failing execution and documented expected output. It would then require the actual vendor sandbox or runtime, access constraints, authentication, replay rules and business acceptance. This exercise cannot establish those details and does not use a client's workflow.

The public-facing claim supported by this project is: “A reproducible synthetic example of diagnosing a payload mismatch, repairing the mapping and testing the result over HTTP.” It does not establish previous paid work or production reliability.
