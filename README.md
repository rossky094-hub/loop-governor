# Loop Governor: a local gate for AI coding loops

Loop Governor is a controller-only post-iteration gate for AI coding workflows.

It does not run agents.
It does not write code.
It does not clean, repair, commit, or merge.

It reads a narrow loop contract and real git status, then returns a governance decision:
`continue`, `stop_for_user`, `update_rail`, `isolate_work`, or `commit`.

Public alpha goal: collect failure reports from real AI coding workflows before claiming production readiness.

Loop Governor can be used around Codex, Claude Code, Cline, Aider, Goose, OpenHands, Plandex, opencode, SWE-agent, and other AI coding workflows. It does not replace them.

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
