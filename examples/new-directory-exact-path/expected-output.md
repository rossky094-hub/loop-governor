# Expected Output

When `allowedPaths` names an exact new file path, some git workflows may initially show only the parent directory in `git status --short`.

If the exact path is not visible, stop and inspect before continuing.

One possible operator technique is:

```bash
git add -N docs/new-guides/example.md
git status --short
```

This exposes the intended path without staging file contents. Use this only as an operator inspection step, not as automatic cleanup or automatic staging.
