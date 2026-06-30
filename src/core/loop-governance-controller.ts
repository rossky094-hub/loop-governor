import {
  isAllowedPath,
  LoopCheckpointSchema,
  type LoopCheckpoint,
  type LoopCheckpointEvidenceRef,
  type LoopGovernanceCannotClaim,
  type LoopGovernanceContract
} from "./loop-governance.js";

export type LoopControllerStatusKind = "tracked" | "untracked" | "ignored";

export interface LoopControllerStatusEntry {
  path: string;
  status: LoopControllerStatusKind;
  raw: string;
}

export interface LoopControllerLaneRule {
  pathPrefix: string;
  lane: string;
}

export interface LoopControllerClassification {
  changedPaths: string[];
  classifiedPaths: string[];
  unclassifiedPaths: string[];
  ignoredResiduePaths: string[];
  explanation: string;
}

export interface CreateLoopCheckpointFromGitStatusInput {
  contract: LoopGovernanceContract;
  gitStatusShortIgnored: string;
  laneRules: LoopControllerLaneRule[];
  iterationId: string;
  evidenceRefs?: LoopCheckpointEvidenceRef[];
  artifactContinuityRefs?: string[];
  classifiedIgnoredResiduePaths?: string[];
  claimStatus: LoopCheckpoint["claimStatus"];
  cannotClaim?: LoopGovernanceCannotClaim[];
  nextAction?: string;
}

export interface CreateLoopCheckpointFromGitStatusResult {
  checkpoint: LoopCheckpoint;
  classification: LoopControllerClassification;
}

function normalizeRepoRelativePath(path: string): string {
  let normalized = path.replace(/\\/g, "/").trim();

  while (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }

  return normalized;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function parseStatusPath(rawLine: string): string {
  const path = rawLine.slice(3).trim();
  const renameSeparator = " -> ";

  if (path.includes(renameSeparator)) {
    return normalizeRepoRelativePath(path.split(renameSeparator).at(-1) ?? path);
  }

  return normalizeRepoRelativePath(path);
}

export function parseGitStatusShortIgnored(gitStatusShortIgnored: string): LoopControllerStatusEntry[] {
  return gitStatusShortIgnored
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const statusCode = line.slice(0, 2);
      const status: LoopControllerStatusKind = statusCode === "!!"
        ? "ignored"
        : statusCode === "??"
          ? "untracked"
          : "tracked";

      return {
        path: parseStatusPath(line),
        status,
        raw: line
      };
    });
}

function findLaneForPath(path: string, laneRules: LoopControllerLaneRule[]): string | undefined {
  return laneRules.find((rule) => isAllowedPath(path, [rule.pathPrefix]))?.lane;
}

function isClassifiedIgnoredResidue(path: string, classifiedIgnoredResiduePaths: string[]): boolean {
  return classifiedIgnoredResiduePaths.some((classifiedPath) =>
    normalizeRepoRelativePath(classifiedPath) === normalizeRepoRelativePath(path)
  );
}

export function createLoopCheckpointFromGitStatus(
  input: CreateLoopCheckpointFromGitStatusInput
): CreateLoopCheckpointFromGitStatusResult {
  const entries = parseGitStatusShortIgnored(input.gitStatusShortIgnored);
  const changedEntries = entries.filter((entry) => entry.status !== "ignored");
  const changedPaths = uniqueStrings(changedEntries.map((entry) => entry.path));
  const ignoredResiduePaths = uniqueStrings(
    entries
      .filter((entry) => entry.status === "ignored")
      .map((entry) => entry.path)
  );
  const laneClassification: LoopCheckpoint["laneClassification"] = {};

  for (const changedPath of changedPaths) {
    if (!isAllowedPath(changedPath, input.contract.allowedPaths)) {
      continue;
    }

    const lane = findLaneForPath(changedPath, input.laneRules);

    if (lane) {
      laneClassification[changedPath] = lane;
    }
  }

  const unclassifiedPaths = changedPaths.filter((changedPath) =>
    !isAllowedPath(changedPath, input.contract.allowedPaths) || !laneClassification[changedPath]
  );
  const unclassifiedTrackedPaths = changedEntries.filter((entry) =>
    entry.status === "tracked" && unclassifiedPaths.includes(entry.path)
  );
  const unclassifiedUntrackedPaths = changedEntries.filter((entry) =>
    entry.status === "untracked" && unclassifiedPaths.includes(entry.path)
  );
  const residueClassified = ignoredResiduePaths.length === 0 ||
    ignoredResiduePaths.every((path) =>
      isClassifiedIgnoredResidue(path, input.classifiedIgnoredResiduePaths ?? [])
    );
  const checkpoint = LoopCheckpointSchema.parse({
    loopId: input.contract.loopId,
    iterationId: input.iterationId,
    changedPaths,
    laneClassification,
    evidenceRefs: input.evidenceRefs ?? [],
    artifactContinuityRefs: input.artifactContinuityRefs ?? [],
    hygiene: {
      trackedStatus: unclassifiedTrackedPaths.length > 0 ? "dirty" : "clean",
      untrackedStatus: unclassifiedUntrackedPaths.length > 0 ? "dirty" : "clean",
      ignoredResidueStatus: ignoredResiduePaths.length > 0 ? "present" : "none",
      residueClassified,
      publishRisk: ignoredResiduePaths.length > 0 && !residueClassified
    },
    claimStatus: input.claimStatus,
    cannotClaim: input.cannotClaim ?? [],
    nextAction: input.nextAction ?? ""
  });

  return {
    checkpoint,
    classification: {
      changedPaths,
      classifiedPaths: Object.keys(laneClassification),
      unclassifiedPaths,
      ignoredResiduePaths,
      explanation: unclassifiedPaths.length > 0
        ? "Some changed paths are outside the contract or lack lane classification."
        : "All non-ignored changed paths are classified for this loop."
    }
  };
}
