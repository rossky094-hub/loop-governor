# Loop Governor

**Stop AI coding agents from quietly wrecking your repo.**

AI coding agents are fast.
They also leave dirty worktrees, out-of-scope files, generated residue, vague "done" claims, and tiny cleanup tasks that slowly bloat a project.

Loop Governor is a local post-iteration gate for Codex, Claude Code, Cline, Aider, OpenHands, Goose, SWE-agent, and other AI coding workflows.

It does not run the agent.
It does not write code.
It does not clean, repair, commit, or merge.

It reads:

- a narrow `project-os-loop.yaml` contract
- real `git status`
- allowed paths and lanes
- required evidence
- claim boundaries

Then it returns a governance decision:

- `continue`
- `stop_for_user`
- `update_rail`
- `isolate_work`
- `commit`

Use it when you want AI agents to move fast without turning your repository into a pile of mystery diffs.

Public alpha goal: collect failure reports from real AI coding workflows before claiming production readiness.

## Minimal Workflow

```text
measured worktree
-> temporary project-os-loop.yaml
-> validate-config-only
-> real git-status gate
-> classify residue
-> claimStatus narrowing
-> commit target change only
```

## Start Here

- `docs/quickstart.md`
- `docs/contract-authoring.md`
- `docs/external-measured-project-recipe.md`
- `docs/cannot-claim.md`
- `docs/decisions.md`

## Cannot Claim

Loop Governor does not control Codex or any agent.
It is not a runner, hook, sandbox, registry, dashboard, plugin, Guardian Agent, or autonomous supervisor.
`continue` does not mean final claim complete.
A valid config does not mean an iteration is safe.

## Install For Local Alpha Use

```bash
npm install
npm test
npm run typecheck
```
