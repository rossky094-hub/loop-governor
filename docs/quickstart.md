# Quickstart

This quickstart uses a separate runner worktree and measured worktree.

```bash
RUNNER=/path/to/loop-governor
MEASURED=/path/to/target-repo

cp "$RUNNER/examples/docs-only/project-os-loop.yaml" "$MEASURED/project-os-loop.yaml"

cd "$RUNNER"
npm install
npm test

npm run cli -- \
  --validate-config-only \
  --root "$MEASURED" \
  --config project-os-loop.yaml

git -C "$MEASURED" status --short --ignored

npm run cli -- \
  --root "$MEASURED" \
  --config project-os-loop.yaml \
  --claim-status needs-confirmation \
  --iteration-id iteration:example-1 \
  --lane-rules-json '[{"pathPrefix":"docs/","lane":"docs"}]' \
  --evidence-json '[{"id":"evidence:manual-review","kind":"review","ref":"operator reviewed changed docs","freshness":"current_iteration","satisfied":true}]'
```

Remove the temporary `project-os-loop.yaml` before committing target-project changes unless that project intentionally adopts Loop Governor.
