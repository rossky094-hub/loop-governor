const { describe, expect, it } = await import("vit" + "est");
import {
  evaluateLocalLoopController
} from "../../src/core/loop-governance-local-controller.js";

const singleContractYaml = `
contracts:
  - version: loop-governor-exploration.v0.1
    loopId: loop:single-docs
    parentGoal: Govern a docs-only loop.
    objective: Evaluate one docs-only iteration.
    allowedLanes:
      - docs
    allowedPaths:
      - docs/
    requiredEvidence: []
    cannotClaim:
      - text: Cannot claim production readiness.
        scope: final_claim
        severity: boundary
    branchOrWorktree: loop-governor-phase1.2-controller-wrapper-implementation
    policy: strict
activeLoops: []
`;

const coreOnlyYaml = singleContractYaml
  .replace("loop:single-docs", "loop:core-only")
  .replace("allowedLanes:\n      - docs", "allowedLanes:\n      - core")
  .replace("allowedPaths:\n      - docs/", "allowedPaths:\n      - src/core/");

describe("evaluateLocalLoopController", () => {
  it("evaluates a single-contract supplied status with inferred lane rules", async () => {
    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: singleContractYaml,
      gitStatusText: " M docs/example.md",
      iterationId: "iteration:single-docs",
      claimStatus: "can-claim"
    });

    expect(output.loopId).toBe("loop:single-docs");
    expect(output.branchOrWorktree).toBe("loop-governor-phase1.2-controller-wrapper-implementation");
    expect(output.iterationId).toBe("iteration:single-docs");
    expect(output.statusSource).toBe("supplied");
    expect(output.classification.classifiedPaths).toEqual(["docs/example.md"]);
    expect(output.decision.decision).toBe("continue");
    expect(output.humanSummary).toBe("CONTINUE: Loop iteration may continue.");
  });

  it("preserves out-of-scope paths so evaluator returns isolate_work", async () => {
    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: singleContractYaml,
      gitStatusText: [
        " M docs/example.md",
        "?? tmp-loop-governor-out-of-scope.txt"
      ].join("\n"),
      iterationId: "iteration:out-of-scope",
      claimStatus: "can-claim"
    });

    expect(output.classification.unclassifiedPaths).toEqual([
      "tmp-loop-governor-out-of-scope.txt"
    ]);
    expect(output.decision.decision).toBe("isolate_work");
  });

  it("stops for unclassified ignored residue without isolating allowed docs work", async () => {
    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: singleContractYaml,
      gitStatusText: [
        " M docs/example.md",
        "!! docs/.DS_Store"
      ].join("\n"),
      iterationId: "iteration:ignored-residue",
      claimStatus: "can-claim"
    });

    expect(output.classification.unclassifiedPaths).toEqual([]);
    expect(output.classification.ignoredResiduePaths).toEqual(["docs/.DS_Store"]);
    expect(output.decision.decision).toBe("stop_for_user");
    expect(output.decision.reason).toMatch(/ignored residue/i);
  });

  it("requires explicit lane rules for multi-lane contracts", async () => {
    const multiLaneYaml = singleContractYaml.replace(
      "allowedLanes:\n      - docs",
      "allowedLanes:\n      - docs\n      - core"
    );

    await expect(evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: multiLaneYaml,
      gitStatusText: " M docs/example.md",
      iterationId: "iteration:multi-lane",
      claimStatus: "can-claim"
    })).rejects.toThrow(/laneRules/i);
  });

  it("uses injected git status when status text is not supplied", async () => {
    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: singleContractYaml,
      getGitStatusText: async () => " M docs/example.md",
      iterationId: "iteration:git-adapter",
      claimStatus: "can-claim"
    });

    expect(output.statusSource).toBe("git");
    expect(output.decision.decision).toBe("continue");
  });

  it("does not invent missing required evidence", async () => {
    const requiredEvidenceYaml = singleContractYaml.replace(
      "requiredEvidence: []",
      [
        "requiredEvidence:",
        "      - id: evidence:focused-test",
        "        kind: test",
        "        ref: npm test -- tests/core/loop-governance-local-controller.test.ts",
        "        freshness: current_iteration"
      ].join("\n")
    );

    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: requiredEvidenceYaml,
      gitStatusText: " M docs/example.md",
      iterationId: "iteration:missing-evidence",
      claimStatus: "can-claim"
    });

    expect(output.decision.decision).toBe("stop_for_user");
    expect(output.decision.reason).toMatch(/Required evidence/i);
  });

  it("returns update_rail for needs-confirmation after path and hygiene gates pass", async () => {
    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: singleContractYaml,
      gitStatusText: " M docs/example.md",
      iterationId: "iteration:needs-confirmation",
      claimStatus: "needs-confirmation"
    });

    expect(output.decision.decision).toBe("update_rail");
  });

  it("does not let inferred one-lane rules classify overlapping prefixes", async () => {
    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: coreOnlyYaml,
      gitStatusText: " M src/corex/leak.ts",
      iterationId: "iteration:overlap-prefix",
      claimStatus: "can-claim"
    });

    expect(output.classification.classifiedPaths).toEqual([]);
    expect(output.classification.unclassifiedPaths).toEqual(["src/corex/leak.ts"]);
    expect(output.decision.decision).toBe("isolate_work");
  });

  it("normalizes backslash paths before lane classification", async () => {
    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: coreOnlyYaml,
      gitStatusText: " M src\\core\\loop-governance.ts",
      iterationId: "iteration:backslash-path",
      claimStatus: "can-claim"
    });

    expect(output.classification.classifiedPaths).toEqual(["src/core/loop-governance.ts"]);
    expect(output.decision.decision).toBe("continue");
  });

  it("does not claim case-insensitive path matching", async () => {
    const output = await evaluateLocalLoopController({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      configText: coreOnlyYaml,
      gitStatusText: " M SRC/core/loop-governance.ts",
      iterationId: "iteration:case-variant",
      claimStatus: "can-claim"
    });

    expect(output.classification.classifiedPaths).toEqual([]);
    expect(output.classification.unclassifiedPaths).toEqual(["SRC/core/loop-governance.ts"]);
    expect(output.decision.decision).toBe("isolate_work");
  });
});
