const { describe, expect, it } = await import("vit" + "est");
import {
  detectLoopPathConflicts,
  evaluateFinalClaim,
  evaluateIteration,
  evaluateLoopIntake,
  isAllowedPath,
  LoopCheckpointSchema,
  LoopConformanceSummarySchema,
  LoopGovernanceContractSchema,
  LoopGovernanceDecisionSchema,
  LoopGovernanceHygieneInputSchema,
  type ActiveLoopRecord,
  type LoopCheckpoint,
  type LoopCheckpointEvidenceRef,
  type LoopConformanceSummary,
  type LoopGovernanceContract,
  type LoopGovernanceDecision,
  type LoopGovernanceHygieneInput
} from "../../src/core/loop-governance.js";

function createContract(overrides: Partial<LoopGovernanceContract> = {}) {
  return {
    version: "loop-governor-exploration.v0.1",
    loopId: "loop:public-alpha-controller",
    parentGoal: "Exercise public alpha controller-only rules.",
    objective: "Define core contract schemas.",
    allowedLanes: ["core"],
    allowedPaths: ["src/core/loop-governance.ts", "tests/core/loop-governance.test.ts"],
    branchOrWorktree: "public-alpha-controller-wrapper",
    ...overrides
  };
}

function createHygiene(overrides: Partial<LoopGovernanceHygieneInput> = {}): LoopGovernanceHygieneInput {
  return {
    trackedStatus: "clean",
    untrackedStatus: "clean",
    ignoredResidueStatus: "none",
    residueClassified: true,
    publishRisk: false,
    ...overrides
  };
}

function createCheckpoint(overrides: Partial<LoopCheckpoint> = {}): LoopCheckpoint {
  return {
    loopId: "loop:public-alpha-controller",
    iterationId: "iteration:controller-test",
    changedPaths: ["src/core/loop-governance.ts"],
    laneClassification: {
      "src/core/loop-governance.ts": "core"
    },
    evidenceRefs: [],
    artifactContinuityRefs: [],
    hygiene: createHygiene(),
    claimStatus: "can-claim",
    cannotClaim: [],
    nextAction: "",
    ...overrides
  };
}

function createRequiredEvidence(
  overrides: Partial<LoopGovernanceContract["requiredEvidence"][number]> = {}
): LoopGovernanceContract["requiredEvidence"][number] {
  return {
    id: "evidence:focused-test",
    kind: "test",
    ref: "npm test -- tests/core/loop-governance.test.ts",
    freshness: "current_iteration",
    ...overrides
  };
}

function createEvidenceRef(
  overrides: Partial<LoopCheckpointEvidenceRef> = {}
): LoopCheckpointEvidenceRef {
  return {
    ...createRequiredEvidence(),
    satisfied: true,
    ...overrides
  };
}

describe("LoopGovernanceContractSchema", () => {
  it("accepts public alpha v0.1 contracts and applies defaults", () => {
    const parsed = LoopGovernanceContractSchema.parse(createContract());

    expect(parsed).toEqual({
      version: "loop-governor-exploration.v0.1",
      loopId: "loop:public-alpha-controller",
      parentGoal: "Exercise public alpha controller-only rules.",
      objective: "Define core contract schemas.",
      allowedLanes: ["core"],
      allowedPaths: ["src/core/loop-governance.ts", "tests/core/loop-governance.test.ts"],
      expectedOutputs: [],
      requiredEvidence: [],
      stopRules: [],
      cannotClaim: [],
      branchOrWorktree: "public-alpha-controller-wrapper",
      policy: "strict"
    });
  });

  it("rejects stale legacy contract labels", () => {
    const result = LoopGovernanceContractSchema.safeParse({
      ...createContract(),
      version: "legacy-loop-governor.v0"
    });

    expect(result.success).toBe(false);
  });

  it("rejects empty required identifiers, lanes, paths, and worktree fields", () => {
    const invalidContracts = [
      createContract({ loopId: "" }),
      createContract({ parentGoal: "" }),
      createContract({ objective: "" }),
      createContract({ allowedLanes: [] }),
      createContract({ allowedLanes: [""] }),
      createContract({ allowedPaths: [] }),
      createContract({ allowedPaths: [""] }),
      createContract({ branchOrWorktree: "" })
    ];

    for (const contract of invalidContracts) {
      expect(LoopGovernanceContractSchema.safeParse(contract).success).toBe(false);
    }
  });

  it("rejects unknown contract keys and empty expected outputs", () => {
    expect(LoopGovernanceContractSchema.safeParse({
      ...createContract(),
      persistentRegistry: "runtime/loops.json"
    }).success).toBe(false);
    expect(LoopGovernanceContractSchema.safeParse(createContract({
      expectedOutputs: [""]
    })).success).toBe(false);
  });

  it("accepts structured evidence requirements, stop rules, and cannot-claim boundaries", () => {
    const parsed = LoopGovernanceContractSchema.parse(createContract({
      expectedOutputs: ["src/core/loop-governance.ts"],
      requiredEvidence: [
        {
          id: "evidence:focused-test",
          kind: "test",
          ref: "npm test -- tests/core/loop-governance.test.ts",
          freshness: "current_iteration"
        }
      ],
      stopRules: [
        {
          kind: "missing_required_evidence",
          threshold: 1,
          reason: "The focused test must pass before claiming controller completion."
        }
      ],
      cannotClaim: [
        {
          text: "Cannot claim publish readiness from this controller-only schema.",
          scope: "publish",
          severity: "boundary"
        }
      ],
      policy: "relaxed"
    }));

    expect(parsed.requiredEvidence[0]).toMatchObject({
      id: "evidence:focused-test",
      kind: "test",
      freshness: "current_iteration"
    });
    expect(parsed.stopRules[0].threshold).toBe(1);
    expect(parsed.cannotClaim[0].severity).toBe("boundary");
    expect(parsed.policy).toBe("relaxed");
  });
});

describe("LoopCheckpointSchema", () => {
  it("parses checkpoint records with structured hygiene and cannot-claim data", () => {
    const evidenceRef: LoopCheckpointEvidenceRef = {
      id: "evidence:focused-test",
      kind: "test",
      ref: "npm test -- tests/core/loop-governance.test.ts",
      freshness: "current_iteration",
      satisfied: true
    };

    const parsed: LoopCheckpoint = LoopCheckpointSchema.parse({
      loopId: "loop:public-alpha-controller",
      iterationId: "iteration:red-green",
      changedPaths: ["src/core/loop-governance.ts"],
      laneClassification: {
        "src/core/loop-governance.ts": "core",
        "tests/core/loop-governance.test.ts": "tests"
      },
      evidenceRefs: [evidenceRef],
      artifactContinuityRefs: ["docs/reports/controller-boundary.md"],
      hygiene: {
        trackedStatus: "clean",
        untrackedStatus: "clean",
        ignoredResidueStatus: "present",
        residueClassified: true,
        publishRisk: false
      },
      claimStatus: "cannot-claim",
      cannotClaim: [
        {
          text: "Cannot claim public release readiness from this controller-only task.",
          scope: "final_claim",
          severity: "blocking"
        }
      ],
      nextAction: "Run focused tests and commit only controller test files."
    });

    expect(parsed.hygiene).toEqual({
      trackedStatus: "clean",
      untrackedStatus: "clean",
      ignoredResidueStatus: "present",
      residueClassified: true,
      publishRisk: false
    });
    expect(parsed.evidenceRefs[0]).toMatchObject({
      kind: "test",
      satisfied: true
    });
    expect(parsed.cannotClaim[0]).toMatchObject({
      scope: "final_claim",
      severity: "blocking"
    });
  });

  it("applies checkpoint collection defaults", () => {
    const parsed = LoopCheckpointSchema.parse({
      loopId: "loop:public-alpha-controller",
      iterationId: "iteration:empty-defaults",
      hygiene: {
        trackedStatus: "unknown",
        untrackedStatus: "unknown",
        ignoredResidueStatus: "unknown",
        residueClassified: false,
        publishRisk: true
      },
      claimStatus: "unknown"
    });

    expect(parsed.changedPaths).toEqual([]);
    expect(parsed.laneClassification).toEqual({});
    expect(parsed.evidenceRefs).toEqual([]);
    expect(parsed.artifactContinuityRefs).toEqual([]);
    expect(parsed.cannotClaim).toEqual([]);
    expect(parsed.nextAction).toBe("");
  });

  it("rejects unknown checkpoint and hygiene keys", () => {
    expect(LoopCheckpointSchema.safeParse({
      loopId: "loop:public-alpha-controller",
      iterationId: "iteration:unknown-top-level",
      hygiene: {
        trackedStatus: "clean",
        untrackedStatus: "clean",
        ignoredResidueStatus: "none",
        residueClassified: true,
        publishRisk: false
      },
      claimStatus: "can-claim",
      persistentRegistry: "runtime/loops.json"
    }).success).toBe(false);

    expect(LoopCheckpointSchema.safeParse({
      loopId: "loop:public-alpha-controller",
      iterationId: "iteration:unknown-hygiene-key",
      hygiene: {
        trackedStatus: "clean",
        untrackedStatus: "clean",
        ignoredResidueStatus: "none",
        residueClassified: true,
        publishRisk: false,
        staleResidueWarning: true
      },
      claimStatus: "can-claim"
    }).success).toBe(false);
  });

  it("rejects empty checkpoint paths, artifact refs, and lane classifications", () => {
    const baseCheckpoint = {
      loopId: "loop:public-alpha-controller",
      iterationId: "iteration:empty-collections",
      hygiene: {
        trackedStatus: "clean",
        untrackedStatus: "clean",
        ignoredResidueStatus: "none",
        residueClassified: true,
        publishRisk: false
      },
      claimStatus: "can-claim"
    };

    expect(LoopCheckpointSchema.safeParse({
      ...baseCheckpoint,
      changedPaths: [""]
    }).success).toBe(false);
    expect(LoopCheckpointSchema.safeParse({
      ...baseCheckpoint,
      artifactContinuityRefs: [""]
    }).success).toBe(false);
    expect(LoopCheckpointSchema.safeParse({
      ...baseCheckpoint,
      laneClassification: { "": "tests" }
    }).success).toBe(false);
    expect(LoopCheckpointSchema.safeParse({
      ...baseCheckpoint,
      laneClassification: { "tests/core/loop-governance.test.ts": "" }
    }).success).toBe(false);
  });
});

describe("LoopGovernanceDecisionSchema", () => {
  it("parses decision records with evidence and cannot-claim data", () => {
    const parsed: LoopGovernanceDecision = LoopGovernanceDecisionSchema.parse({
      decision: "reject_worker_output",
      reason: "Worker touched example files outside Task 1 write set.",
      evidenceRefs: ["git diff --name-only"],
      cannotClaim: [
        {
          text: "Cannot claim the worker output is accepted until the diff whitelist is clean.",
          scope: "iteration",
          severity: "blocking"
        }
      ]
    });

    expect(parsed).toEqual({
      decision: "reject_worker_output",
      reason: "Worker touched example files outside Task 1 write set.",
      evidenceRefs: ["git diff --name-only"],
      cannotClaim: [
        {
          text: "Cannot claim the worker output is accepted until the diff whitelist is clean.",
          scope: "iteration",
          severity: "blocking"
        }
      ]
    });
  });

  it("applies decision collection defaults", () => {
    const parsed = LoopGovernanceDecisionSchema.parse({
      decision: "continue",
      reason: "Focused test passed and the diff stayed inside the controller write set."
    });

    expect(parsed.evidenceRefs).toEqual([]);
    expect(parsed.cannotClaim).toEqual([]);
  });

  it("rejects unknown decision keys and empty evidence refs", () => {
    expect(LoopGovernanceDecisionSchema.safeParse({
      decision: "continue",
      reason: "Focused test passed and the diff stayed inside the controller write set.",
      persistentRegistry: "runtime/loops.json"
    }).success).toBe(false);
    expect(LoopGovernanceDecisionSchema.safeParse({
      decision: "continue",
      reason: "Focused test passed and the diff stayed inside the controller write set.",
      evidenceRefs: [""]
    }).success).toBe(false);
  });
});

describe("LoopConformanceSummarySchema", () => {
  it("is exported and rejects invalid runtime conformance summaries", () => {
    expect(LoopConformanceSummarySchema.safeParse({
      status: "bogus",
      evidenceRefs: ["conformance:summary"],
      claimBoundary: []
    }).success).toBe(false);
    expect(LoopConformanceSummarySchema.safeParse({
      status: "conformant",
      evidenceRefs: [""],
      claimBoundary: []
    }).success).toBe(false);
  });
});

describe("LoopGovernanceHygieneInputSchema", () => {
  it("is exported and rejects invalid runtime hygiene snapshots", () => {
    expect(LoopGovernanceHygieneInputSchema.safeParse({
      trackedStatus: "clean",
      untrackedStatus: "lost",
      ignoredResidueStatus: "none",
      residueClassified: true,
      publishRisk: false
    }).success).toBe(false);
  });
});

describe("loop governance pure evaluators", () => {
  it("intake stops invalid contract paths and names the invalid field", () => {
    const decision = evaluateLoopIntake({
      contract: createContract({
        allowedPaths: ["../outside.ts"]
      }),
      hygiene: createHygiene()
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/allowedPaths|path/i);
  });

  it("intake stops dirty unclassified hygiene and preserves contract cannot-claim", () => {
    const cannotClaim = [
      {
        text: "Cannot claim publish readiness from the controller-only loop.",
        scope: "publish",
        severity: "boundary"
      }
    ] satisfies LoopGovernanceContract["cannotClaim"];

    const decision = evaluateLoopIntake({
      contract: createContract({ cannotClaim }),
      hygiene: createHygiene({
        trackedStatus: "dirty",
        residueClassified: false
      })
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/hygiene|dirty/i);
    expect(decision.cannotClaim).toEqual(cannotClaim);
  });

  it("intake stops unknown hygiene", () => {
    const decision = evaluateLoopIntake({
      contract: createContract(),
      hygiene: createHygiene({
        trackedStatus: "unknown"
      })
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/unknown|hygiene/i);
  });

  it("intake stops invalid runtime hygiene", () => {
    const decision = evaluateLoopIntake({
      contract: createContract(),
      hygiene: {
        trackedStatus: "clean",
        untrackedStatus: "lost",
        ignoredResidueStatus: "none",
        residueClassified: true,
        publishRisk: false
      }
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/invalid hygiene/i);
  });

  it("intake isolates active loop path conflicts", () => {
    const activeLoops: ActiveLoopRecord[] = [
      {
        loopId: "loop:other-core-work",
        allowedPaths: ["src/core/other.ts"],
        branchOrWorktree: "other-worktree"
      }
    ];

    const decision = evaluateLoopIntake({
      contract: createContract({
        allowedPaths: ["src/core/"]
      }),
      hygiene: createHygiene(),
      activeLoops
    });

    expect(decision.decision).toBe("isolate_work");
    expect(decision.reason).toMatch(/conflict/i);
  });

  it("intake stops invalid runtime active loops without throwing", () => {
    expect(() => evaluateLoopIntake({
      contract: createContract(),
      hygiene: createHygiene(),
      activeLoops: [
        {
          loopId: "",
          allowedPaths: ["src/core/loop-governance.ts"]
        }
      ]
    })).not.toThrow();

    const decision = evaluateLoopIntake({
      contract: createContract(),
      hygiene: createHygiene(),
      activeLoops: [
        {
          loopId: "",
          allowedPaths: ["src/core/loop-governance.ts"]
        }
      ]
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/invalid activeLoops/i);
  });

  it("intake stops active loops with parent-directory path scopes", () => {
    const decision = evaluateLoopIntake({
      contract: createContract(),
      hygiene: createHygiene(),
      activeLoops: [
        {
          loopId: "loop:other-core-work",
          allowedPaths: ["../src/core/foo.ts"]
        }
      ]
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/invalid activeLoops|invalid active loop path/i);
  });

  it("intake stops active loops with absolute path scopes", () => {
    const decision = evaluateLoopIntake({
      contract: createContract(),
      hygiene: createHygiene(),
      activeLoops: [
        {
          loopId: "loop:other-core-work",
          allowedPaths: ["/repo/src/core/foo.ts"]
        }
      ]
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/invalid activeLoops|invalid active loop path/i);
  });

  it("intake accepts valid active loops with optional remaining budget and still detects conflicts", () => {
    const activeLoops: ActiveLoopRecord[] = [
      {
        loopId: "loop:other-core-work",
        allowedPaths: ["src/core/loop-governance.ts"],
        branchOrWorktree: "other-worktree",
        remainingBudget: 2
      }
    ];

    const decision = evaluateLoopIntake({
      contract: createContract(),
      hygiene: createHygiene(),
      activeLoops
    });

    expect(decision.decision).toBe("isolate_work");
  });

  it("iteration isolates path escape under a boundary-safe allowed directory", () => {
    const decision = evaluateIteration({
      contract: createContract({
        allowedPaths: ["src/core/"]
      }),
      checkpoint: createCheckpoint({
        changedPaths: ["src/corex/not-allowed.ts"],
        laneClassification: {
          "src/corex/not-allowed.ts": "core"
        }
      })
    });

    expect(decision.decision).toBe("isolate_work");
  });

  it("iteration accepts normalized backslash paths", () => {
    const decision = evaluateIteration({
      contract: createContract({
        allowedPaths: ["src/core/"]
      }),
      checkpoint: createCheckpoint({
        changedPaths: ["src\\core\\loop-governance.ts"],
        laneClassification: {
          "src\\core\\loop-governance.ts": "core"
        }
      })
    });

    expect(decision.decision).toBe("continue");
  });

  it.each([
    ["../src/core/loop-governance.ts"],
    ["/repo/src/core/loop-governance.ts"],
    ["SRC/core/file.ts"]
  ])("iteration rejects unsafe or non-matching path %s", (changedPath: string) => {
    const decision = evaluateIteration({
      contract: createContract({
        allowedPaths: ["src/core/"]
      }),
      checkpoint: createCheckpoint({
        changedPaths: [changedPath],
        laneClassification: {
          [changedPath]: "core"
        }
      })
    });

    expect(decision.decision).toBe("isolate_work");
  });

  it("iteration rejects disallowed lane classifications", () => {
    const decision = evaluateIteration({
      contract: createContract({
        allowedLanes: ["core"],
        allowedPaths: ["src/core/"]
      }),
      checkpoint: createCheckpoint({
        changedPaths: ["src/core/loop-governance.ts"],
        laneClassification: {
          "src/core/loop-governance.ts": "docs"
        }
      })
    });

    expect(decision.decision).toBe("reject_worker_output");
  });

  it("iteration stops when an allowed changed path is missing lane classification", () => {
    const decision = evaluateIteration({
      contract: createContract({
        allowedPaths: ["src/core/"]
      }),
      checkpoint: createCheckpoint({
        changedPaths: ["src/core/loop-governance.ts"],
        laneClassification: {}
      })
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/missing lane classification/i);
  });

  it("iteration stops when required evidence is missing", () => {
    const decision = evaluateIteration({
      contract: createContract({
        requiredEvidence: [createRequiredEvidence()]
      }),
      checkpoint: createCheckpoint()
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/evidence/i);
  });

  it("iteration stops when matching required evidence is unsatisfied", () => {
    const decision = evaluateIteration({
      contract: createContract({
        requiredEvidence: [createRequiredEvidence()]
      }),
      checkpoint: createCheckpoint({
        evidenceRefs: [
          createEvidenceRef({
            satisfied: false
          })
        ]
      })
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/unsatisfied|evidence/i);
  });

  it("strict policy rejects current-slice test evidence for current-iteration requirements", () => {
    const decision = evaluateIteration({
      contract: createContract({
        policy: "strict",
        requiredEvidence: [createRequiredEvidence()]
      }),
      checkpoint: createCheckpoint({
        evidenceRefs: [
          createEvidenceRef({
            freshness: "current_slice"
          })
        ]
      })
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/stale|evidence/i);
  });

  it.each(["doc", "hygiene"] as const)(
    "relaxed policy accepts current-slice %s evidence for current-iteration requirements",
    (kind: "doc" | "hygiene") => {
      const decision = evaluateIteration({
        contract: createContract({
          policy: "relaxed",
          requiredEvidence: [
            createRequiredEvidence({
              kind,
              ref: `evidence/${kind}.md`
            })
          ]
        }),
        checkpoint: createCheckpoint({
          evidenceRefs: [
            createEvidenceRef({
              kind,
              ref: `evidence/${kind}.md`,
              freshness: "current_slice"
            })
          ]
        })
      });

      expect(decision.decision).toBe("continue");
    }
  );

  it.each([
    "test",
    "typecheck",
    "build",
    "report",
    "conformance",
    "artifact-continuity"
  ] as const)("relaxed policy still rejects stale %s evidence", (
    kind: "test" | "typecheck" | "build" | "report" | "conformance" | "artifact-continuity"
  ) => {
    const decision = evaluateIteration({
      contract: createContract({
        policy: "relaxed",
        requiredEvidence: [
          createRequiredEvidence({
            kind,
            ref: `evidence/${kind}.txt`
          })
        ]
      }),
      checkpoint: createCheckpoint({
        evidenceRefs: [
          createEvidenceRef({
            kind,
            ref: `evidence/${kind}.txt`,
            freshness: "current_slice"
          })
        ]
      })
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/stale|evidence/i);
  });

  it.each([
    ["untracked dirty", createHygiene({ untrackedStatus: "dirty" })],
    ["untracked unknown", createHygiene({ untrackedStatus: "unknown" })],
    ["ignored residue unknown", createHygiene({ ignoredResidueStatus: "unknown" })],
    [
      "ignored residue present and unclassified",
      createHygiene({
        ignoredResidueStatus: "present",
        residueClassified: false
      })
    ],
    [
      "publish risk true and unclassified",
      createHygiene({
        publishRisk: true,
        residueClassified: false
      })
    ]
  ] as const)("iteration stops when hygiene is %s", (
    _caseName: string,
    hygiene: LoopGovernanceHygieneInput
  ) => {
    const decision = evaluateIteration({
      contract: createContract(),
      checkpoint: createCheckpoint({ hygiene })
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/hygiene|residue|risk/i);
  });

  it("relaxed policy still isolates path escapes", () => {
    const decision = evaluateIteration({
      contract: createContract({
        policy: "relaxed",
        allowedPaths: ["src/core/"]
      }),
      checkpoint: createCheckpoint({
        changedPaths: ["src/corex/not-allowed.ts"],
        laneClassification: {
          "src/corex/not-allowed.ts": "core"
        }
      })
    });

    expect(decision.decision).toBe("isolate_work");
  });

  it("needs-confirmation returns update rail while preserving cannot-claim data", () => {
    const contractCannotClaim = [
      {
        text: "Cannot claim public release readiness from core-only work.",
        scope: "publish",
        severity: "boundary"
      }
    ] satisfies LoopGovernanceContract["cannotClaim"];
    const checkpointCannotClaim = [
      {
        text: "Cannot claim the current iteration until the checkpoint is confirmed.",
        scope: "iteration",
        severity: "info"
      }
    ] satisfies LoopCheckpoint["cannotClaim"];

    const decision = evaluateIteration({
      contract: createContract({
        cannotClaim: contractCannotClaim
      }),
      checkpoint: createCheckpoint({
        claimStatus: "needs-confirmation",
        cannotClaim: checkpointCannotClaim
      })
    });

    expect(decision.decision).toBe("update_rail");
    expect(decision.cannotClaim).toEqual([...contractCannotClaim, ...checkpointCannotClaim]);
  });

  it("iteration cannot-claim returns stop for user while preserving cannot-claim data", () => {
    const contractCannotClaim = [
      {
        text: "Cannot claim publish readiness from this controller-only evaluator.",
        scope: "publish",
        severity: "boundary"
      }
    ] satisfies LoopGovernanceContract["cannotClaim"];
    const checkpointCannotClaim = [
      {
        text: "Cannot claim this checkpoint as complete.",
        scope: "final_claim",
        severity: "blocking"
      }
    ] satisfies LoopCheckpoint["cannotClaim"];

    const decision = evaluateIteration({
      contract: createContract({
        cannotClaim: contractCannotClaim
      }),
      checkpoint: createCheckpoint({
        claimStatus: "cannot-claim",
        cannotClaim: checkpointCannotClaim
      })
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.cannotClaim).toEqual([...contractCannotClaim, ...checkpointCannotClaim]);
  });

  it("blocking iteration cannot-claim stops the iteration", () => {
    const decision = evaluateIteration({
      contract: createContract(),
      checkpoint: createCheckpoint({
        cannotClaim: [
          {
            text: "Cannot claim iteration safety until worker output is reviewed.",
            scope: "iteration",
            severity: "blocking"
          }
        ]
      })
    });

    expect(decision.decision).toBe("stop_for_user");
  });

  it("contract-level blocking iteration cannot-claim stops the iteration", () => {
    const cannotClaim = [
      {
        text: "Cannot claim iteration safety until the parent contract boundary is resolved.",
        scope: "iteration",
        severity: "blocking"
      }
    ] satisfies LoopGovernanceContract["cannotClaim"];

    const decision = evaluateIteration({
      contract: createContract({ cannotClaim }),
      checkpoint: createCheckpoint()
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.cannotClaim).toEqual(cannotClaim);
  });

  it("final claim stops when conformance is missing", () => {
    const decision = evaluateFinalClaim({
      contract: createContract(),
      checkpoint: createCheckpoint()
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/conformance/i);
  });

  it.each(["needs_confirmation", "unknown"] as const)(
    "final claim stops when conformance is %s",
    (status: "needs_confirmation" | "unknown") => {
      const conformance: LoopConformanceSummary = {
        status,
        evidenceRefs: [`conformance:${status}`],
        claimBoundary: []
      };

      const decision = evaluateFinalClaim({
        contract: createContract(),
        checkpoint: createCheckpoint(),
        conformance
      });

      expect(decision.decision).toBe("stop_for_user");
      expect(decision.reason).toMatch(/conformance/i);
    }
  );

  it("final claim creates a repair path when conformance is non-conformant", () => {
    const decision = evaluateFinalClaim({
      contract: createContract(),
      checkpoint: createCheckpoint(),
      conformance: {
        status: "non_conformant",
        evidenceRefs: ["conformance:non-conformant"],
        claimBoundary: []
      }
    });

    expect(decision.decision).toBe("create_repair_path");
  });

  it("final claim creates a repair path when conformance is partially conformant", () => {
    const requiredEvidence = createRequiredEvidence({
      ref: "focused-test-output"
    });
    const checkpoint = createCheckpoint({
      evidenceRefs: [
        createEvidenceRef({
          ref: "focused-test-output"
        }),
        createEvidenceRef({
          id: "evidence:typecheck",
          kind: "typecheck",
          ref: "tsc -p tsconfig.json --noEmit",
          freshness: "current_iteration"
        })
      ]
    });
    const conformance: LoopConformanceSummary = {
      status: "partially_conformant",
      evidenceRefs: ["focused-test-output", "conformance:summary"],
      claimBoundary: ["Final claim cannot be committed from partial conformance."]
    };

    const decision = evaluateFinalClaim({
      contract: createContract({
        requiredEvidence: [requiredEvidence]
      }),
      checkpoint,
      conformance
    });

    expect(decision.decision).toBe("create_repair_path");
  });

  it("final claim stops when conformant conformance has no evidence refs", () => {
    const requiredEvidence = createRequiredEvidence({
      ref: "focused-test-output"
    });
    const checkpoint = createCheckpoint({
      evidenceRefs: [
        createEvidenceRef({
          ref: "focused-test-output"
        })
      ]
    });

    const decision = evaluateFinalClaim({
      contract: createContract({
        requiredEvidence: [requiredEvidence]
      }),
      checkpoint,
      conformance: {
        status: "conformant",
        evidenceRefs: [],
        claimBoundary: []
      }
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/conformance evidence|evidenceRefs/i);
  });

  it("final claim stops when a blocking final-claim cannot-claim is present", () => {
    const cannotClaim = [
      {
        text: "Cannot claim final completion until the claim boundary is resolved.",
        scope: "final_claim",
        severity: "blocking"
      }
    ] satisfies LoopCheckpoint["cannotClaim"];

    const decision = evaluateFinalClaim({
      contract: createContract(),
      checkpoint: createCheckpoint({ cannotClaim }),
      conformance: {
        status: "conformant",
        evidenceRefs: ["conformance:summary"],
        claimBoundary: []
      }
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.cannotClaim).toEqual(cannotClaim);
  });

  it("final claim stops when runtime conformance is invalid", () => {
    const decision = evaluateFinalClaim({
      contract: createContract(),
      checkpoint: createCheckpoint(),
      conformance: {
        status: "bogus",
        evidenceRefs: ["conformance:summary"],
        claimBoundary: []
      }
    });

    expect(decision.decision).toBe("stop_for_user");
    expect(decision.reason).toMatch(/invalid conformance/i);
  });

  it("final claim commits only when checkpoint, evidence, and conformant conformance align", () => {
    const requiredEvidence = createRequiredEvidence({
      ref: "focused-test-output"
    });
    const checkpoint = createCheckpoint({
      evidenceRefs: [
        createEvidenceRef({
          ref: "focused-test-output"
        }),
        createEvidenceRef({
          id: "evidence:typecheck",
          kind: "typecheck",
          ref: "tsc -p tsconfig.json --noEmit",
          freshness: "current_iteration"
        })
      ]
    });
    const conformance: LoopConformanceSummary = {
      status: "conformant",
      evidenceRefs: ["focused-test-output", "conformance:summary"],
      claimBoundary: []
    };

    const decision = evaluateFinalClaim({
      contract: createContract({
        requiredEvidence: [requiredEvidence]
      }),
      checkpoint,
      conformance
    });
    const notClaimable = evaluateFinalClaim({
      contract: createContract(),
      checkpoint: createCheckpoint({
        claimStatus: "unknown"
      }),
      conformance: {
        status: "conformant",
        evidenceRefs: ["conformance:summary"],
        claimBoundary: []
      }
    });

    expect(decision.decision).toBe("commit");
    expect(decision.evidenceRefs).toEqual([
      "focused-test-output",
      "tsc -p tsconfig.json --noEmit",
      "conformance:summary"
    ]);
    expect(notClaimable.decision).toBe("stop_for_user");
  });

  it("checks allowed paths and path conflicts with boundary-safe matching", () => {
    expect(isAllowedPath("src/core/foo.ts", ["src/core/"])).toBe(true);
    expect(isAllowedPath("src/corex/foo.ts", ["src/core/"])).toBe(false);

    const conflicts = detectLoopPathConflicts(
      LoopGovernanceContractSchema.parse(createContract({
        allowedPaths: ["src/core/"]
      })),
      [
        {
          loopId: "loop:other-core",
          allowedPaths: ["src/core/foo.ts"],
          branchOrWorktree: "other-core-worktree"
        },
        {
          loopId: "loop:other-corex",
          allowedPaths: ["src/corex/foo.ts"],
          branchOrWorktree: "other-corex-worktree"
        }
      ]
    );

    expect(conflicts).toEqual([
      {
        loopId: "loop:public-alpha-controller",
        path: "src/core/",
        conflictingLoopId: "loop:other-core",
        conflictingPath: "src/core/foo.ts"
      }
    ]);
  });
});
