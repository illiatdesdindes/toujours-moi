# Build workflows

`build-stack` turns a chain of `ready-for-agent` tickets into a gh stack, one PR per ticket. It was ported from makt (`~/work/makt/.claude/workflows`). Run it by name with the Workflow tool. The orchestrator (the main session) stays in the loop and settles every open question with the user in the chat, never on GitHub.

For each ticket, in order:

1. **Implement:** TDD, a browser pass for UI, then the local CI (`npm run lint && npm run check && npm test`).
2. **Review:** the Standards and Spec axes of `/code-review`, run as two parallel agents.
3. **Fix:** an agent fixes the review findings.
4. **QA:** a functional agent, then a design agent, both test through agent-browser against `prototypes/02-screens.html`. Both are skipped when the diff has no UI. They run one after the other because they share `.dev.vars` (the dev viewer) and the local D1 state.
5. **Fix after QA:** an agent fixes the QA findings.
6. **Ship:** `gh stack submit --auto --remote origin`, then the PR title and body.

```js
args: {
  worktree: "/Users/samy/work/toujours-moi",  // where the stack lives (gh stack metadata is per worktree)
  base_branch: "main",                         // or the top branch of the existing stack
  first_in_stack: true,                        // true → gh stack init; false → gh stack add on base_branch
  tickets: [{ issue: 3, slug: "scaffold", title: "Scaffold: SvelteKit + Pop theme + test harness + CI" }],
  user_decisions: { 3: "…" },                  // optional, see below
}
```

The run stops at the first `needs_decision` and returns the questions with options and a recommendation. Settle them with the user, then re-run with `user_decisions[<issue>]` set and `resumeFromRunId`. Steps before that ticket replay from cache. The run returns `next_base_branch` for the next batch.

Each ticket writes a decision log to `docs/build-log/<issue>-<slug>.md`, and that log becomes the PR body.

Agents never touch Cloudflare production: `cf`/D1 commands run with `--local` only. Production (#12) is the user's.

The dev server for browser passes and QA runs on port 23781 (makt uses the 22xxx block). Don't run two batches of this repo at the same time.

## Known limits

- Workflow agents can't spawn sub-agents. That's why the review axes run as sibling agents.
- `/implement` can only be invoked by the user, so its instructions are copied into the Implement step.
- Web Push can't be fully tested in agent-browser: the integration test with a fake push endpoint is the check.
- makt's `address-reviews` workflow (apply PR review comments down the stack) isn't ported yet.
