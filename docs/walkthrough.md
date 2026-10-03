# Five-minute walkthrough

1. Run the installation, tests and demo commands in README.md.
2. Trace one successful request from the example through src/ to the fixture.
3. Find a negative test and explain why the request is rejected.
4. Change a fictional input, predict the result and rerun the test.
5. Explain which production requirements are deliberately outside this project.

For the reliability extension, run `npm run lab`. Compare the expected and actual states at each process-exit checkpoint. Then inspect `test/replay.test.mjs` for the concurrent-process test and explain why the local fulfillment and event completion must commit together. The [replay case study](replay-case-study.md) summarizes the evidence and limits.

Use the case study as a presentation outline. Describe this as an AI-assisted personal demonstration, and distinguish observed results from expectations for a future client system.
