# External Measured Project Recipe

Use this recipe when Loop Governor runs from one worktree while gating a separate target project.

## Runner / Measured Worktree Preflight

Keep the runner worktree separate from the measured worktree:

```text
runner worktree != measured worktree
```

The runner may have local dependencies such as `node_modules/`. The measured worktree should not gain dependency residue merely because the Loop Governor CLI was used.

```bash
RUNNER=/path/to/loop-governor
MEASURED=/path/to/target-repo

git -C "$RUNNER" status --short --ignored | sed -n '1,120p'
git -C "$MEASURED" status --short --ignored | sed -n '1,120p'
test -f "$RUNNER/src/loop-governance-controller-cli.ts"
test -f "$RUNNER/package.json"
```

## Temporary Contract Lifecycle

1. Create a temporary `project-os-loop.yaml` in the measured repo.
2. Run `--validate-config-only` with `--root "$MEASURED"`.
3. Use the contract for the local post-iteration gate.
4. Remove the temporary contract before the target-project commit unless that repo intentionally adopts Loop Governor.

The temporary contract is local loop-control input. It is not proof that the measured repo has adopted Loop Governor.

## Baseline Ignored Residue Classification

Real target repos often have baseline ignored residue. Do not blindly clean residue, and do not blindly classify all residue as safe.

Use this sequence:

1. Capture `git status --short --ignored`.
2. Identify ignored paths such as `.venv/`, `.pytest_cache/`, `outputs/`, `dist/`, or `__pycache__/`.
3. Decide whether each path predates the current loop or was created by it.
4. Classify only the residue you can explain.
5. Stop for user review if a path may contain publish-risk output or current-loop generated state.

## `claimStatus` Narrowing

If the gate returns `update_rail` because `claimStatus` is `needs-confirmation`, pause.

Then:

1. State the narrow claim for this loop.
2. Confirm that the changed paths and evidence support only that claim.
3. Rerun with `--claim-status can-claim` only if the scoped claim is true.
4. Keep broader goals in `cannotClaim`.

A `continue` decision means the current scoped gate is clear. It does not mean the final target is complete.
