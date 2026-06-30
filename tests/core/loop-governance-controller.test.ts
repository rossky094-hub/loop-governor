const { describe, expect, it } = await import("vit" + "est");
import {
  evaluateIteration,
  type LoopCheckpointEvidenceRef,
  type LoopGovernanceContract
} from "../../src/core/loop-governance.js";
import {
  createLoopCheckpointFromGitStatus,
  parseGitStatusShortIgnored
} from "../../src/core/loop-governance-controller.js";

function createDocsOnlyContract(): LoopGovernanceContract {
  return {
    version: "loop-governor-exploration.v0.1",
    loopId: "loop:docs-only-fixture",
    parentGoal: "Validate controller classification for a public docs-only example.",
    objective: "Classify raw status for a docs-only loop.",
    allowedLanes: ["docs"],
    allowedPaths: ["docs/"],
    expectedOutputs: ["docs/example.md"],
    requiredEvidence: [
      {
        id: "evidence:classifier-focused-test",
        kind: "test",
        ref: "npm test -- tests/core/loop-governance-controller.test.ts",
        freshness: "current_iteration"
      }
    ],
    stopRules: [
      {
        kind: "path_out_of_scope",
        reason: "Docs-only classifier fixture must isolate out-of-scope paths."
      }
    ],
    cannotClaim: [
      {
        text: "Cannot claim controller classifier is production-ready from this fixture.",
        scope: "final_claim",
        severity: "boundary"
      }
    ],
    branchOrWorktree: "public-alpha-classifier-example",
    policy: "strict"
  };
}

function freshEvidence(): LoopCheckpointEvidenceRef[] {
  return [
    {
      id: "evidence:classifier-focused-test",
      kind: "test",
      ref: "npm test -- tests/core/loop-governance-controller.test.ts",
      freshness: "current_iteration",
      satisfied: true
    }
  ];
}

describe("parseGitStatusShortIgnored", () => {
  it("parses tracked, untracked, and ignored short status entries", () => {
    expect(parseGitStatusShortIgnored([
      " M docs/example.md",
      "?? tmp-loop-governor-out-of-scope.txt",
      "!! docs/.DS_Store"
    ].join("\n"))).toEqual([
      {
        path: "docs/example.md",
        status: "tracked",
        raw: " M docs/example.md"
      },
      {
        path: "tmp-loop-governor-out-of-scope.txt",
        status: "untracked",
        raw: "?? tmp-loop-governor-out-of-scope.txt"
      },
      {
        path: "docs/.DS_Store",
        status: "ignored",
        raw: "!! docs/.DS_Store"
      }
    ]);
  });
});

describe("createLoopCheckpointFromGitStatus", () => {
  it("keeps out-of-scope changed paths visible so evaluateIteration isolates work", () => {
    const contract = createDocsOnlyContract();
    const { checkpoint, classification } = createLoopCheckpointFromGitStatus({
      contract,
      gitStatusShortIgnored: [
        " M docs/example.md",
        "?? tmp-loop-governor-out-of-scope.txt"
      ].join("\n"),
      laneRules: [
        {
          pathPrefix: "docs/",
          lane: "docs"
        }
      ],
      iterationId: "iteration:out-of-scope-fixture",
      evidenceRefs: freshEvidence(),
      claimStatus: "can-claim",
      nextAction: "Isolate the out-of-scope file before continuing."
    });

    expect(checkpoint.changedPaths).toEqual([
      "docs/example.md",
      "tmp-loop-governor-out-of-scope.txt"
    ]);
    expect(checkpoint.laneClassification).toEqual({
      "docs/example.md": "docs"
    });
    expect(classification.unclassifiedPaths).toEqual([
      "tmp-loop-governor-out-of-scope.txt"
    ]);
    expect(checkpoint.hygiene).toMatchObject({
      trackedStatus: "clean",
      untrackedStatus: "dirty",
      ignoredResidueStatus: "none",
      residueClassified: true,
      publishRisk: false
    });

    const decision = evaluateIteration({
      contract,
      checkpoint
    });

    expect(decision.decision).toBe("isolate_work");
    expect(decision.reason).toContain("tmp-loop-governor-out-of-scope.txt");
  });

  it("returns a clean checkpoint for allowed classified docs changes with fresh evidence", () => {
    const contract = createDocsOnlyContract();
    const { checkpoint, classification } = createLoopCheckpointFromGitStatus({
      contract,
      gitStatusShortIgnored: " M docs/example.md",
      laneRules: [
        {
          pathPrefix: "docs/",
          lane: "docs"
        }
      ],
      iterationId: "iteration:allowed-docs-fixture",
      evidenceRefs: freshEvidence(),
      claimStatus: "can-claim",
      nextAction: "Continue the docs-only loop."
    });

    expect(classification.unclassifiedPaths).toEqual([]);
    expect(checkpoint.hygiene).toEqual({
      trackedStatus: "clean",
      untrackedStatus: "clean",
      ignoredResidueStatus: "none",
      residueClassified: true,
      publishRisk: false
    });

    const decision = evaluateIteration({
      contract,
      checkpoint
    });

    expect(decision.decision).toBe("continue");
  });

  it("marks unclassified ignored residue so evaluateIteration stops instead of false-greening hygiene", () => {
    const contract = createDocsOnlyContract();
    const { checkpoint, classification } = createLoopCheckpointFromGitStatus({
      contract,
      gitStatusShortIgnored: [
        " M docs/example.md",
        "!! docs/.DS_Store"
      ].join("\n"),
      laneRules: [
        {
          pathPrefix: "docs/",
          lane: "docs"
        }
      ],
      iterationId: "iteration:ignored-residue-fixture",
      evidenceRefs: freshEvidence(),
      claimStatus: "can-claim",
      nextAction: "Classify or remove ignored residue before continuing."
    });

    expect(classification.ignoredResiduePaths).toEqual(["docs/.DS_Store"]);
    expect(checkpoint.changedPaths).toEqual(["docs/example.md"]);
    expect(checkpoint.hygiene).toMatchObject({
      ignoredResidueStatus: "present",
      residueClassified: false,
      publishRisk: true
    });

    const decision = evaluateIteration({
      contract,
      checkpoint
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/ignored residue|hygiene/i);
  });
});
