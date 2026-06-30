import { z } from "zod";

export const LOOP_GOVERNANCE_CONTRACT_VERSION = "loop-governor-exploration.v0.1" as const;

const nonEmptyStringSchema = z.string().trim().min(1);

export const LoopGovernanceEvidenceRequirementSchema = z.object({
  id: nonEmptyStringSchema,
  kind: z.enum([
    "test",
    "typecheck",
    "build",
    "report",
    "doc",
    "hygiene",
    "conformance",
    "artifact-continuity"
  ]),
  ref: nonEmptyStringSchema,
  freshness: z.enum(["current_iteration", "current_slice", "any"])
}).strict();

export const LoopGovernanceStopRuleSchema = z.object({
  kind: z.enum([
    "budget_exceeded",
    "dirty_unclassified_worktree",
    "path_out_of_scope",
    "missing_required_evidence",
    "cannot_claim_blocking",
    "final_contract_unconfirmed"
  ]),
  threshold: z.number().finite().optional(),
  reason: nonEmptyStringSchema
}).strict();

export const LoopGovernanceCannotClaimSchema = z.object({
  text: nonEmptyStringSchema,
  scope: z.enum(["iteration", "final_claim", "publish", "mainline_merge"]),
  severity: z.enum(["blocking", "boundary", "info"])
}).strict();

export const LoopGovernanceContractSchema = z.object({
  version: z.literal(LOOP_GOVERNANCE_CONTRACT_VERSION),
  loopId: nonEmptyStringSchema,
  parentGoal: nonEmptyStringSchema,
  objective: nonEmptyStringSchema,
  allowedLanes: z.array(nonEmptyStringSchema).min(1),
  allowedPaths: z.array(nonEmptyStringSchema).min(1),
  expectedOutputs: z.array(nonEmptyStringSchema).default([]),
  requiredEvidence: z.array(LoopGovernanceEvidenceRequirementSchema).default([]),
  stopRules: z.array(LoopGovernanceStopRuleSchema).default([]),
  cannotClaim: z.array(LoopGovernanceCannotClaimSchema).default([]),
  branchOrWorktree: nonEmptyStringSchema,
  policy: z.enum(["strict", "relaxed"]).default("strict")
}).strict();

export const LoopCheckpointEvidenceRefSchema = LoopGovernanceEvidenceRequirementSchema.extend({
  satisfied: z.boolean()
}).strict();

export const LoopCheckpointHygieneSchema = z.object({
  trackedStatus: z.enum(["clean", "dirty", "unknown"]),
  untrackedStatus: z.enum(["clean", "dirty", "unknown"]),
  ignoredResidueStatus: z.enum(["none", "present", "unknown"]),
  residueClassified: z.boolean(),
  publishRisk: z.boolean()
}).strict();

export const LoopCheckpointSchema = z.object({
  loopId: nonEmptyStringSchema,
  iterationId: nonEmptyStringSchema,
  changedPaths: z.array(nonEmptyStringSchema).default([]),
  laneClassification: z.record(nonEmptyStringSchema, nonEmptyStringSchema).default({}),
  evidenceRefs: z.array(LoopCheckpointEvidenceRefSchema).default([]),
  artifactContinuityRefs: z.array(nonEmptyStringSchema).default([]),
  hygiene: LoopCheckpointHygieneSchema,
  claimStatus: z.enum(["can-claim", "cannot-claim", "needs-confirmation", "unknown"]),
  cannotClaim: z.array(LoopGovernanceCannotClaimSchema).default([]),
  nextAction: z.string().default("")
}).strict();

export const LoopGovernanceDecisionSchema = z.object({
  decision: z.enum([
    "continue",
    "stop_for_user",
    "update_rail",
    "isolate_work",
    "reject_worker_output",
    "commit",
    "write_plan",
    "create_repair_path"
  ]),
  reason: nonEmptyStringSchema,
  evidenceRefs: z.array(nonEmptyStringSchema).default([]),
  cannotClaim: z.array(LoopGovernanceCannotClaimSchema).default([])
}).strict();

export const LoopGovernanceHygieneInputSchema = LoopCheckpointHygieneSchema;

const activeLoopPathSchema = nonEmptyStringSchema.refine(
  (path) => normalizeRepoRelativePath(path) !== undefined,
  { message: "invalid active loop path" }
);

export const ActiveLoopRecordSchema = z.object({
  loopId: nonEmptyStringSchema,
  allowedPaths: z.array(activeLoopPathSchema).min(1),
  branchOrWorktree: nonEmptyStringSchema.optional(),
  remainingBudget: z.number().finite().optional()
}).strict();

export const LoopConformanceSummarySchema = z.object({
  status: z.enum([
    "conformant",
    "partially_conformant",
    "non_conformant",
    "needs_confirmation",
    "unknown"
  ]),
  evidenceRefs: z.array(nonEmptyStringSchema).min(1),
  claimBoundary: z.array(nonEmptyStringSchema)
}).strict();

export type LoopGovernanceEvidenceRequirement = z.infer<typeof LoopGovernanceEvidenceRequirementSchema>;
export type LoopGovernanceStopRule = z.infer<typeof LoopGovernanceStopRuleSchema>;
export type LoopGovernanceCannotClaim = z.infer<typeof LoopGovernanceCannotClaimSchema>;
export type LoopGovernanceContract = z.infer<typeof LoopGovernanceContractSchema>;
export type LoopCheckpointEvidenceRef = z.infer<typeof LoopCheckpointEvidenceRefSchema>;
export type LoopCheckpointHygiene = z.infer<typeof LoopCheckpointHygieneSchema>;
export type LoopCheckpoint = z.infer<typeof LoopCheckpointSchema>;
export type LoopGovernanceDecision = z.infer<typeof LoopGovernanceDecisionSchema>;
export type LoopGovernanceHygieneInput = z.infer<typeof LoopGovernanceHygieneInputSchema>;
export type ActiveLoopRecord = z.infer<typeof ActiveLoopRecordSchema>;
export type LoopConformanceSummary = z.infer<typeof LoopConformanceSummarySchema>;

export interface LoopPathConflict {
  loopId: string;
  path: string;
  conflictingLoopId: string;
  conflictingPath: string;
}

type EvidenceFailureKind = "missing" | "unsatisfied" | "stale";

function formatZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  const fieldPath = issue?.path.length ? issue.path.join(".") : "contract";

  return `${fieldPath}: ${issue?.message ?? "invalid value"}`;
}

function normalizeRepoRelativePath(path: string): string | undefined {
  let normalized = path.replace(/\\/g, "/").trim();

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  if (
    normalized === "" ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("/") ||
    normalized.startsWith("../") ||
    normalized.includes("/../") ||
    normalized.endsWith("/..") ||
    normalized.startsWith("//") ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    return undefined;
  }

  return normalized;
}

function pathMatchesScope(path: string, allowedPath: string): boolean {
  const normalizedPath = normalizeRepoRelativePath(path);
  const normalizedAllowedPath = normalizeRepoRelativePath(allowedPath);

  if (!normalizedPath || !normalizedAllowedPath) {
    return false;
  }

  if (normalizedAllowedPath.endsWith("/")) {
    const directoryPath = normalizedAllowedPath.slice(0, -1);

    return normalizedPath === directoryPath || normalizedPath.startsWith(normalizedAllowedPath);
  }

  return normalizedPath === normalizedAllowedPath;
}

function pathsOverlap(path: string, otherPath: string): boolean {
  return pathMatchesScope(path, otherPath) || pathMatchesScope(otherPath, path);
}

function createDecision(
  decision: LoopGovernanceDecision["decision"],
  reason: string,
  options: {
    evidenceRefs?: string[];
    cannotClaim?: LoopGovernanceCannotClaim[];
  } = {}
): LoopGovernanceDecision {
  return LoopGovernanceDecisionSchema.parse({
    decision,
    reason,
    evidenceRefs: uniqueStrings(options.evidenceRefs ?? []),
    cannotClaim: options.cannotClaim ?? []
  });
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function parseContractForEvaluation(contractInput: unknown): {
  contract?: LoopGovernanceContract;
  decision?: LoopGovernanceDecision;
} {
  const parsed = LoopGovernanceContractSchema.safeParse(contractInput);

  if (!parsed.success) {
    return {
      decision: createDecision(
        "stop_for_user",
        `Invalid contract field/path: ${formatZodError(parsed.error)}`
      )
    };
  }

  const invalidAllowedPath = parsed.data.allowedPaths.find(
    (allowedPath) => !isAllowedPath(allowedPath, [allowedPath])
  );

  if (invalidAllowedPath) {
    return {
      decision: createDecision(
        "stop_for_user",
        `Invalid contract allowedPaths path: ${invalidAllowedPath}`,
        {
          cannotClaim: parsed.data.cannotClaim
        }
      )
    };
  }

  return {
    contract: parsed.data
  };
}

function parseCheckpointForEvaluation(
  checkpointInput: unknown,
  contractCannotClaim: LoopGovernanceCannotClaim[]
): {
  checkpoint?: LoopCheckpoint;
  decision?: LoopGovernanceDecision;
} {
  const parsed = LoopCheckpointSchema.safeParse(checkpointInput);

  if (!parsed.success) {
    return {
      decision: createDecision(
        "stop_for_user",
        `Invalid checkpoint field/path: ${formatZodError(parsed.error)}`,
        {
          cannotClaim: contractCannotClaim
        }
      )
    };
  }

  return {
    checkpoint: parsed.data
  };
}

function getHygieneStopReason(hygiene?: LoopGovernanceHygieneInput): string | undefined {
  if (!hygiene) {
    return undefined;
  }

  if (hygiene.trackedStatus === "dirty" || hygiene.trackedStatus === "unknown") {
    return `Hygiene tracked status is ${hygiene.trackedStatus}.`;
  }

  if (hygiene.untrackedStatus === "dirty" || hygiene.untrackedStatus === "unknown") {
    return `Hygiene untracked status is ${hygiene.untrackedStatus}.`;
  }

  if (hygiene.ignoredResidueStatus === "unknown") {
    return "Hygiene ignored residue status is unknown.";
  }

  if (hygiene.ignoredResidueStatus === "present" && !hygiene.residueClassified) {
    return "Hygiene ignored residue is present and unclassified.";
  }

  if (hygiene.publishRisk && !hygiene.residueClassified) {
    return "Hygiene publish risk is true with unclassified residue.";
  }

  return undefined;
}

function findLaneClassification(
  changedPath: string,
  laneClassification: LoopCheckpoint["laneClassification"]
): string | undefined {
  if (laneClassification[changedPath]) {
    return laneClassification[changedPath];
  }

  const normalizedChangedPath = normalizeRepoRelativePath(changedPath);

  if (!normalizedChangedPath) {
    return undefined;
  }

  for (const [path, lane] of Object.entries(laneClassification)) {
    if (normalizeRepoRelativePath(path) === normalizedChangedPath) {
      return lane;
    }
  }

  return undefined;
}

function isFreshEnough(
  requirement: LoopGovernanceEvidenceRequirement,
  evidenceRef: LoopCheckpointEvidenceRef,
  policy: LoopGovernanceContract["policy"]
): boolean {
  if (requirement.freshness === "any") {
    return true;
  }

  if (requirement.freshness === "current_slice") {
    return evidenceRef.freshness === "current_slice" || evidenceRef.freshness === "current_iteration";
  }

  if (evidenceRef.freshness === "current_iteration") {
    return true;
  }

  return policy === "relaxed" &&
    evidenceRef.freshness === "current_slice" &&
    (requirement.kind === "doc" || requirement.kind === "hygiene");
}

function getEvidenceFailure(
  requirement: LoopGovernanceEvidenceRequirement,
  evidenceRefs: LoopCheckpointEvidenceRef[],
  policy: LoopGovernanceContract["policy"]
): EvidenceFailureKind | undefined {
  const matchingEvidence = evidenceRefs.filter((evidenceRef) =>
    evidenceRef.id === requirement.id &&
    evidenceRef.kind === requirement.kind &&
    evidenceRef.ref === requirement.ref
  );

  if (matchingEvidence.length === 0) {
    return "missing";
  }

  const satisfiedEvidence = matchingEvidence.filter((evidenceRef) => evidenceRef.satisfied);

  if (satisfiedEvidence.length === 0) {
    return "unsatisfied";
  }

  if (satisfiedEvidence.some((evidenceRef) => isFreshEnough(requirement, evidenceRef, policy))) {
    return undefined;
  }

  return "stale";
}

function checkpointEvidenceRefs(checkpoint: LoopCheckpoint): string[] {
  return checkpoint.evidenceRefs.map((evidenceRef) => evidenceRef.ref);
}

function combinedCannotClaim(
  contract: LoopGovernanceContract,
  checkpoint: LoopCheckpoint
): LoopGovernanceCannotClaim[] {
  return [...contract.cannotClaim, ...checkpoint.cannotClaim];
}

function evaluateParsedIteration(
  contract: LoopGovernanceContract,
  checkpoint: LoopCheckpoint
): LoopGovernanceDecision {
  const cannotClaim = combinedCannotClaim(contract, checkpoint);

  for (const changedPath of checkpoint.changedPaths) {
    if (!isAllowedPath(changedPath, contract.allowedPaths)) {
      return createDecision(
        "isolate_work",
        `Changed path is outside allowedPaths or invalid: ${changedPath}`,
        {
          cannotClaim
        }
      );
    }
  }

  for (const changedPath of checkpoint.changedPaths) {
    const lane = findLaneClassification(changedPath, checkpoint.laneClassification);

    if (!lane) {
      return createDecision(
        "stop_for_user",
        `Changed path ${changedPath} is missing lane classification.`,
        {
          cannotClaim
        }
      );
    }

    if (lane && !contract.allowedLanes.includes(lane)) {
      return createDecision(
        "reject_worker_output",
        `Changed path ${changedPath} is classified as disallowed lane ${lane}.`,
        {
          cannotClaim
        }
      );
    }
  }

  for (const requirement of contract.requiredEvidence) {
    const failure = getEvidenceFailure(requirement, checkpoint.evidenceRefs, contract.policy);

    if (failure) {
      return createDecision(
        "stop_for_user",
        `Required evidence ${requirement.id} is ${failure}.`,
        {
          evidenceRefs: checkpointEvidenceRefs(checkpoint),
          cannotClaim
        }
      );
    }
  }

  const hygieneStopReason = getHygieneStopReason(checkpoint.hygiene);

  if (hygieneStopReason) {
    return createDecision("stop_for_user", hygieneStopReason, {
      cannotClaim
    });
  }

  if (
    cannotClaim.some((cannotClaimItem) =>
      cannotClaimItem.scope === "iteration" && cannotClaimItem.severity === "blocking"
    )
  ) {
    return createDecision(
      "stop_for_user",
      "Checkpoint contains a blocking iteration cannot-claim boundary.",
      {
        cannotClaim
      }
    );
  }

  if (checkpoint.claimStatus === "needs-confirmation") {
    return createDecision("update_rail", "Checkpoint claim status needs confirmation.", {
      cannotClaim
    });
  }

  if (checkpoint.claimStatus === "cannot-claim") {
    return createDecision("stop_for_user", "Checkpoint claim status is cannot-claim.", {
      cannotClaim
    });
  }

  return createDecision("continue", "Loop iteration may continue.", {
    evidenceRefs: checkpointEvidenceRefs(checkpoint),
    cannotClaim
  });
}

export function isAllowedPath(path: string, allowedPaths: string[]): boolean {
  return allowedPaths.some((allowedPath) => pathMatchesScope(path, allowedPath));
}

export function detectLoopPathConflicts(
  contract: LoopGovernanceContract,
  activeLoops: ActiveLoopRecord[] = []
): LoopPathConflict[] {
  const conflicts: LoopPathConflict[] = [];

  for (const activeLoop of activeLoops) {
    if (activeLoop.loopId === contract.loopId) {
      continue;
    }

    for (const path of contract.allowedPaths) {
      for (const conflictingPath of activeLoop.allowedPaths) {
        if (!normalizeRepoRelativePath(path) || !normalizeRepoRelativePath(conflictingPath)) {
          continue;
        }

        if (pathsOverlap(path, conflictingPath)) {
          conflicts.push({
            loopId: contract.loopId,
            path: normalizeRepoRelativePath(path) ?? path,
            conflictingLoopId: activeLoop.loopId,
            conflictingPath: normalizeRepoRelativePath(conflictingPath) ?? conflictingPath
          });
        }
      }
    }
  }

  return conflicts;
}

export function evaluateLoopIntake(input: {
  contract: unknown;
  hygiene?: unknown;
  activeLoops?: unknown;
}): LoopGovernanceDecision {
  const contractResult = parseContractForEvaluation(input.contract);

  if (contractResult.decision) {
    return contractResult.decision!;
  }

  const contract = contractResult.contract!;

  const hygieneResult = input.hygiene === undefined
    ? undefined
    : LoopGovernanceHygieneInputSchema.safeParse(input.hygiene);

  if (hygieneResult && !hygieneResult.success) {
    return createDecision(
      "stop_for_user",
      `Invalid hygiene: ${formatZodError(hygieneResult.error)}`,
      {
        cannotClaim: contract.cannotClaim
      }
    );
  }

  const hygieneStopReason = getHygieneStopReason(hygieneResult?.data);

  if (hygieneStopReason) {
    return createDecision("stop_for_user", hygieneStopReason, {
      cannotClaim: contract.cannotClaim
    });
  }

  const activeLoopsResult = input.activeLoops === undefined
    ? undefined
    : z.array(ActiveLoopRecordSchema).safeParse(input.activeLoops);

  if (activeLoopsResult && !activeLoopsResult.success) {
    return createDecision(
      "stop_for_user",
      `Invalid activeLoops: ${formatZodError(activeLoopsResult.error)}`,
      {
        cannotClaim: contract.cannotClaim
      }
    );
  }

  const conflicts = detectLoopPathConflicts(contract, activeLoopsResult?.data ?? []);

  if (conflicts.length > 0) {
    return createDecision("isolate_work", "Active loop path scopes conflict.", {
      evidenceRefs: conflicts.map((conflict) => `${conflict.conflictingLoopId}:${conflict.conflictingPath}`),
      cannotClaim: contract.cannotClaim
    });
  }

  return createDecision("continue", "Loop intake may continue.", {
    cannotClaim: contract.cannotClaim
  });
}

export function evaluateIteration(input: {
  contract: unknown;
  checkpoint: unknown;
}): LoopGovernanceDecision {
  const contractResult = parseContractForEvaluation(input.contract);

  if (contractResult.decision) {
    return contractResult.decision!;
  }

  const contract = contractResult.contract!;
  const checkpointResult = parseCheckpointForEvaluation(
    input.checkpoint,
    contract.cannotClaim
  );

  if (!checkpointResult.checkpoint) {
    return checkpointResult.decision!;
  }

  return evaluateParsedIteration(contract, checkpointResult.checkpoint);
}

export function evaluateFinalClaim(input: {
  contract: unknown;
  checkpoint: unknown;
  conformance?: unknown;
}): LoopGovernanceDecision {
  const contractResult = parseContractForEvaluation(input.contract);

  if (contractResult.decision) {
    return contractResult.decision!;
  }

  const contract = contractResult.contract!;
  const checkpointResult = parseCheckpointForEvaluation(
    input.checkpoint,
    contract.cannotClaim
  );

  if (!checkpointResult.checkpoint) {
    return checkpointResult.decision!;
  }

  const cannotClaim = combinedCannotClaim(contract, checkpointResult.checkpoint);

  if (!input.conformance) {
    return createDecision("stop_for_user", "Missing conformance summary.", {
      evidenceRefs: checkpointEvidenceRefs(checkpointResult.checkpoint),
      cannotClaim
    });
  }

  const conformanceResult = LoopConformanceSummarySchema.safeParse(input.conformance);

  if (!conformanceResult.success) {
    return createDecision(
      "stop_for_user",
      `Invalid conformance summary: ${formatZodError(conformanceResult.error)}`,
      {
        evidenceRefs: checkpointEvidenceRefs(checkpointResult.checkpoint),
        cannotClaim
      }
    );
  }

  const conformance = conformanceResult.data;
  const evidenceRefs = uniqueStrings([
    ...checkpointEvidenceRefs(checkpointResult.checkpoint),
    ...conformance.evidenceRefs
  ]);

  if (conformance.status === "needs_confirmation" || conformance.status === "unknown") {
    return createDecision("stop_for_user", `Conformance status is ${conformance.status}.`, {
      evidenceRefs,
      cannotClaim
    });
  }

  if (conformance.status === "non_conformant") {
    return createDecision("create_repair_path", "Conformance is non-conformant.", {
      evidenceRefs,
      cannotClaim
    });
  }

  if (conformance.status === "partially_conformant") {
    return createDecision("create_repair_path", "Conformance is partially conformant.", {
      evidenceRefs,
      cannotClaim
    });
  }

  const iterationDecision = evaluateParsedIteration(contract, checkpointResult.checkpoint);

  if (iterationDecision.decision !== "continue") {
    return iterationDecision;
  }

  if (
    cannotClaim.some((cannotClaimItem) =>
      cannotClaimItem.scope === "final_claim" && cannotClaimItem.severity === "blocking"
    )
  ) {
    return createDecision(
      "stop_for_user",
      "Final claim contains a blocking cannot-claim boundary.",
      {
        evidenceRefs,
        cannotClaim
      }
    );
  }

  if (checkpointResult.checkpoint.claimStatus !== "can-claim") {
    return createDecision("stop_for_user", "Final checkpoint claim status is not can-claim.", {
      evidenceRefs,
      cannotClaim
    });
  }

  return createDecision("commit", "Final claim may be committed.", {
    evidenceRefs,
    cannotClaim
  });
}
