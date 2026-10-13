export const meta = {
  name: 'build-stack',
  description: 'Implement TJM tickets one by one as a gh stack: implement → review → fix → QA → fix → ship',
  whenToUse: 'Build the next batch of ready-for-agent tickets on top of the stack',
  phases: [
    { title: 'Implement' }, { title: 'Review' }, { title: 'Fix' },
    { title: 'QA' }, { title: 'Fix after QA' }, { title: 'Ship' },
  ],
}

// args: { worktree, base_branch, first_in_stack, tickets: [{ issue, slug, title }], user_decisions?: { <issue>: "…" } }
// Ported from makt (~/work/makt/.claude/workflows). See .claude/workflows/README.md.
const WT = args.worktree
const BROWSER_RULE = 'Never kill agent-browser globally (no pkill/killall): other sessions share this machine; close only your own session with `agent-browser close`.'
// ponytail: globbed, not pinned, so a plugin upgrade doesn't break the review stage.
const REVIEW_SKILL = 'the newest `~/.claude/plugins/cache/mattpocock/mattpocock-skills/*/skills/engineering/code-review/SKILL.md` (`ls -d` the glob, take the highest version)'
const CLOUDFLARE_RULE = 'Cloudflare: local only. `cf`/D1 commands always with `--mode development|test` and `--local`; never `--remote`, `--mode production`, a deploy, a secret, DNS or Access change. Those are production and belong to the user (#12).'
const ENV = `Run \`npm ci\` when \`node_modules\` is missing or package-lock.json changed. ${CLOUDFLARE_RULE}`
const CI = 'the full local CI: `npm run lint && npm run check && npm test` (the scripts #3 defines in package.json; while building #3 itself, make them exist). Everything must pass'
const COMMIT = 'Commit with a conventional message ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commits must be GPG-signed: if signing fails inside the sandbox, rerun the git command outside it; never use --no-gpg-sign.'
const QA_PORT = 23781 // makt uses 22780–22782; a different block so both repos can build at once.
const SERVER = `${ENV} If \`.dev.vars\` is missing, create it from \`.dev.vars.example\`. Run the local migrations and seed (\`npm run db:migrate:local\`, \`npm run db:seed:local\`, when they exist). Start the app in the background with \`npm run dev -- --port ${QA_PORT} --strictPort\` and stop it when you are done. The viewer is \`DEV_VIEWER_EMAIL\` in \`.dev.vars\` (once #4 exists): to test another role, set it to another seeded user and restart the server; put back the original value at the end. On phone width, once #11's install gate exists, use a narrow viewport without touch emulation so the gate doesn't block you (and test the gate itself with touch emulation when the ticket touches it).`

const QUESTIONS = { type: 'array', items: { type: 'object', properties: {
  question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } },
  recommendation: { type: 'string' }, why_it_blocks: { type: 'string' } },
  required: ['question', 'options', 'recommendation', 'why_it_blocks'] } }
const WORK = { type: 'object', properties: {
  status: { type: 'string', enum: ['done', 'needs_decision', 'failed'] },
  summary: { type: 'string' }, questions: QUESTIONS },
  required: ['status', 'summary', 'questions'] }
const FINDINGS = { type: 'object', properties: {
  applicable: { type: 'boolean', description: 'false when the diff has nothing for this reviewer (e.g. no UI change)' },
  findings: { type: 'array', items: { type: 'object', properties: {
    severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
    where: { type: 'string' }, problem: { type: 'string' }, evidence: { type: 'string' } },
    required: ['severity', 'where', 'problem', 'evidence'] } } },
  required: ['applicable', 'findings'] }

const ctx = (t, branch, base) => `You are working on TJM ("Toujours Moi", a family chore-tracking PWA) ticket #${t.issue} in the git worktree \`${WT}\` (always \`cd ${WT}\` first). The ticket's branch is \`${branch}\`, stacked on \`${base}\`. Read the ticket with \`gh issue view ${t.issue}\`, its parent issue #2, AGENTS.md, and the docs it cites: \`docs/spec.md\` (the spec: decisions Q1–Q20, Technical deltas, Data model, Routes), \`prototypes/02-screens.html\` (the working reference for every screen, the Pop theme and the copy), \`design/logo/\`, GLOSSARY.md and docs/adr/ when they exist. The spec copies patterns from notakid (\`~/work/notakid\`, read its AGENTS.md and the files the spec names): copy them, don't reinvent them. Code in English, UI in French. Earlier tickets' decision logs are in \`docs/build-log/\`.${decided(t)}`
const LOG = (t) => `\`docs/build-log/${t.issue}-${t.slug}.md\``
const decided = (t) => args.user_decisions?.[t.issue] ? `\n\n**Decisions the user already made for this ticket (binding, record them in the decision log):**\n${args.user_decisions[t.issue]}` : ''
const ESCALATE = `If something can't be settled from the ticket, the spec, the prototype or a sensible default, AND a wrong guess would be costly to undo, stop and return status "needs_decision" with the questions (options + your recommendation). Never post questions to GitHub (issue or PR): the orchestrator asks the user. Anything smaller you decide yourself and record in the decision log.`
const DECISION_LOG = (t) => `Record every judgement call you made yourself (what, the options, why you picked this one) in ${LOG(t)}, sections: "Acceptance criteria" (ticked list), "Decisions", "Deviations from spec" (should be empty), "Skipped review/QA findings" (with reasons). Create it if missing, append if present, and commit it.`

// Doubts go back to the orchestrator, who settles them with the user in the chat (never on GitHub).
// Re-run with args.user_decisions[<issue>] set: it changes this ticket's prompts, so resume re-runs from here.
function escalate(t, stage, r) {
  log(`#${t.issue} needs a decision at ${stage}: stopping the chain`)
  return { issue: t.issue, status: 'needs_decision', stage, questions: r.questions }
}

const fix = (t, branch, base, stage, reports) => agent(`${ctx(t, branch, base)} Check out \`${branch}\`. ${ENV}

Apply these ${stage === 'Fix' ? 'code-review' : 'QA'} findings to the ticket's work:
${JSON.stringify(reports, null, 2)}

Fix every blocker and major. Fix minors when cheap. A finding you judge wrong or out of scope: skip it and record why. Keep tests green: rerun the affected test files, then ${CI}. ${COMMIT}
${DECISION_LOG(t)}
${ESCALATE}`, { label: `${stage.toLowerCase()} #${t.issue}`, phase: stage, schema: WORK })

const results = []
let base = args.base_branch
let first = args.first_in_stack

for (const t of args.tickets) {
  const branch = `build/${t.issue}-${t.slug}`
  const stackCmd = first ? `gh stack init --base ${base} ${branch}` : `git checkout ${base} && gh stack add ${branch}`

  // 1. Implement (the /mattpocock-skills:implement instructions, inlined: the skill is user-only)
  phase('Implement')
  const impl = await agent(`${ctx(t, branch, base)} First create the branch: \`${stackCmd}\` (if \`${branch}\` already exists, just check it out).

Implement the ticket end to end:
- ${ENV}
- Use the /tdd skill where possible, at seams that fit the spec: pure TS modules under \`src/lib/\` for the unit project, the built Worker + local D1 for the integration project. Schema changes are new numbered, additive D1 migrations.
- Shared UI goes in \`src/lib/components/\` (one component per concept, e.g. the single \`ChoreTypePicker\` the spec asks for); build it from daisyUI classes and the Pop theme tokens, matching \`prototypes/02-screens.html\`.
- Run single test files regularly, and ${CI} once at the end.
- For UI work, do the browser pass AGENTS.md asks for yourself before finishing: ${SERVER} Use agent-browser with AGENT_BROWSER_SESSION=tjm-impl-${t.issue}. ${BROWSER_RULE}
- Tick every acceptance criterion ("Done when"), or explain in the decision log why one isn't met.
- ${COMMIT} Commit on \`${branch}\` as you go. Don't push and don't open a PR.
A separate review runs after you, so don't run /code-review yourself.
${DECISION_LOG(t)}
${ESCALATE}`, { label: `implement #${t.issue}`, phase: 'Implement', schema: WORK })
  if (!impl || impl.status === 'failed') { results.push({ issue: t.issue, status: 'failed', stage: 'Implement', summary: impl?.summary }); break }
  if (impl.status === 'needs_decision') { results.push(escalate(t, 'Implement', impl)); break }

  // 2. Review: the two /code-review axes as sibling agents (workflow agents can't spawn sub-agents)
  phase('Review')
  const axis = (axisName, brief) => agent(`${ctx(t, branch, base)} Check out \`${branch}\`. Diff: \`git diff ${base}...${branch}\`; commits: \`git log ${base}..${branch} --oneline\`.

You are the **${axisName}** sub-agent of the code-review skill defined in ${REVIEW_SKILL}. Read that file and follow the ${axisName} brief exactly. ${brief} Read-only: change nothing. Report each finding with severity, location and evidence (quote the rule or spec line).`,
    { label: `review:${axisName.toLowerCase()} #${t.issue}`, phase: 'Review', schema: FINDINGS })
  const reviews = (await parallel([
    () => axis('Standards', 'Standards sources: AGENTS.md, the "Technical deltas" section of docs/spec.md, notakid\'s AGENTS.md for the patterns copied from it, the naming rules in ~/.agents/AGENTS.md (names reveal intent, banned bare names), plus the smell baseline in that skill file.'),
    () => axis('Spec', `The spec: issue #${t.issue}, its parent #2, and the docs/spec.md sections it cites; for UI, prototypes/02-screens.html.`),
  ])).filter(Boolean)
  const reviewFindings = reviews.flatMap(r => r.findings)

  // 3. Fix the review findings
  if (reviewFindings.length) {
    const f1 = await fix(t, branch, base, 'Fix', reviewFindings)
    if (!f1 || f1.status === 'failed') { results.push({ issue: t.issue, status: 'failed', stage: 'Fix', summary: f1?.summary }); break }
    if (f1.status === 'needs_decision') { results.push(escalate(t, 'Fix', f1)); break }
  }

  // 4. QA: feature + adjacent features, then visual design, via agent-browser.
  // ponytail: sequential, not parallel: both share .dev.vars (the viewer) and the local D1 state.
  phase('QA')
  const qaCommon = (session) => `Check out \`${branch}\`. If the diff \`git diff ${base}...${branch}\` has no UI or UX change, return applicable=false with no findings and stop. Otherwise: ${SERVER} Use agent-browser with AGENT_BROWSER_SESSION=${session}. ${BROWSER_RULE} Read-only on the code: report, don't fix.`
  const qa = []
  qa.push(await agent(`${ctx(t, branch, base)} ${qaCommon(`tjm-qa-feature-${t.issue}`)}

You are the **functional QA** agent. Use the /agent-browser skill to work through every acceptance criterion of #${t.issue} as a real user would, in each role it concerns (admin, parent, child), including edge cases: empty states, validation errors, double submits, back button, a reload mid-flow, going offline when the ticket touches the outbox. Then smoke-test the **adjacent features** this change could break (earlier tickets in docs/build-log/ show what exists). Report each defect with steps to reproduce, expected and actual behaviour.`,
    { label: `qa:feature #${t.issue}`, phase: 'QA', schema: FINDINGS }))
  qa.push(await agent(`${ctx(t, branch, base)} ${qaCommon(`tjm-qa-design-${t.issue}`)}

You are the **design QA** agent. Use the /agent-browser skill and screenshots (Read each PNG) to check every screen and state this ticket touches against \`prototypes/02-screens.html\` (open it in agent-browser too, side by side) and the Pop theme in docs/spec.md: daisyUI semantic colours and theme tokens, no raw palette colours, French copy as the spec and prototype give it, the viewer's personal colour tint. Check the layout at desktop and phone widths (no horizontal scroll), focus states and contrast. Report each issue with a screenshot path, expected and actual.`,
    { label: `qa:design #${t.issue}`, phase: 'QA', schema: FINDINGS }))
  const qaRan = qa.filter(Boolean)
  const qaFindings = qaRan.filter(r => r.applicable).flatMap(r => r.findings)

  // 5. Fix the QA findings
  if (qaFindings.length) {
    const f2 = await fix(t, branch, base, 'Fix after QA', qaFindings)
    if (!f2 || f2.status === 'failed') { results.push({ issue: t.issue, status: 'failed', stage: 'Fix after QA', summary: f2?.summary }); break }
    if (f2.status === 'needs_decision') { results.push(escalate(t, 'Fix after QA', f2)); break }
  }

  // 6. Ship: push the stack, open or update this branch's PR
  phase('Ship')
  const ship = await agent(`${ctx(t, branch, base)} Check out \`${branch}\`.
1. Make sure ${LOG(t)} exists and is committed; if ${CI} doesn't pass, fix it and commit. ${COMMIT}
2. \`gh stack submit --auto --remote origin\` (pushes every branch of the stack and creates the missing PRs as drafts). Never \`gh pr create\`.
3. Edit this branch's PR: a conventional title, \`<type>(<scope>): ${t.title} (#${t.issue})\`. Body: "Closes #${t.issue}", a short summary of what was built, then the full contents of ${LOG(t)}, then the line "🤖 Generated with [Claude Code](https://claude.com/claude-code)". Use \`gh pr edit <n> --title … --body-file …\`.
4. Verify with \`gh stack view --json\` that this layer shows its PR number.
Return the PR URL in the summary.`, { label: `ship #${t.issue}`, phase: 'Ship', schema: WORK, effort: 'low' })

  results.push({ issue: t.issue, branch, status: ship?.status ?? 'failed', pr: ship?.summary,
    review_findings: reviewFindings.length, qa_findings: qaFindings.length,
    qa_skipped: qaRan.filter(r => !r.applicable).length })
  if (!ship || ship.status !== 'done') break
  base = branch
  first = false
}

return { results, next_base_branch: base }
