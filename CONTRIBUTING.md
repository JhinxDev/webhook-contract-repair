# Working on the example

1. Read the [contract](docs/contract.md) and identify the behaviour being changed.
2. Add a failing regression that expresses the expected result, including a negative case when changing validation.
3. Keep source logic separate from intentionally broken fixtures.
4. Run `npm run check`, `npm test` and `npm run demo`.
5. Update the contract, case study and verification limits if behaviour changes.

Use synthetic inputs only. Keep changes small and avoid adding dependencies unless they solve a documented need. This is a portfolio example, not a supported product or an invitation to submit customer production incidents.
