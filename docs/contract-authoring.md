# Contract Authoring

Use a temporary `project-os-loop.yaml` to describe one bounded loop.

Quote strings that contain punctuation, especially `:` and `#`.

```yaml
objective: "Run one docs-only goal: record the controller decision."
```

Do not write:

```yaml
objective: Run one docs-only goal: record the controller decision.
```

Unquoted punctuation-heavy strings can fail YAML parsing before Loop Governor reaches governance evaluation.

## Validate Config Only

```bash
npm run cli -- \
  --validate-config-only \
  --root /path/to/measured-worktree \
  --config project-os-loop.yaml
```

When the runner worktree is separate from the measured worktree, always pass the measured worktree through `--root`. A relative `--config project-os-loop.yaml` is resolved against `--root`.

Config-only validation checks YAML parseability, contract schema shape, required fields, structured evidence/cannot-claim fields, repository-relative `allowedPaths`, unsafe absolute paths, and unsafe parent traversal.

Config-only validation does not read git status, classify changed paths, evaluate an iteration, check evidence freshness from the filesystem, or decide whether a loop may continue.

## Lane Rules Boundary

Missing multi-lane `laneRules` is not a config-only validation error.

If a controller invocation uses multiple lanes, the invocation still needs explicit `--lane-rules-json` so the wrapper can classify changed paths. That is an invocation-time requirement, not a static YAML-only property.

## Cannot Claim

A valid config does not mean an iteration is safe.

A valid config does not mean the final claim is complete.
