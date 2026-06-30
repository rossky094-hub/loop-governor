import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { parseLoopGovernanceConfig } from "./loop-governance-config.js";
import {
  evaluateIteration,
  type LoopCheckpoint,
  type LoopCheckpointEvidenceRef,
  type LoopGovernanceContract,
  type LoopGovernanceDecision
} from "./loop-governance.js";
import {
  createLoopCheckpointFromGitStatus,
  type LoopControllerClassification,
  type LoopControllerLaneRule
} from "./loop-governance-controller.js";

const execFileAsync = promisify(execFile);

export interface LocalLoopControllerInput {
  repoRoot: string;
  configPath?: string;
  configText?: string;
  loopId?: string;
  gitStatusText?: string;
  laneRules?: LoopControllerLaneRule[];
  evidenceRefs?: LoopCheckpointEvidenceRef[];
  classifiedIgnoredResiduePaths?: string[];
  claimStatus: LoopCheckpoint["claimStatus"];
  iterationId: string;
  nextAction?: string;
  readTextFile?: (path: string) => Promise<string>;
  getGitStatusText?: (repoRoot: string) => Promise<string>;
}

export interface LocalLoopControllerOutput {
  loopId: string;
  branchOrWorktree: string;
  iterationId: string;
  statusSource: "supplied" | "git";
  classification: LoopControllerClassification;
  checkpoint: LoopCheckpoint;
  decision: LoopGovernanceDecision;
  humanSummary: string;
}

function formatHumanSummary(decision: LoopGovernanceDecision): string {
  return `${decision.decision.toUpperCase()}: ${decision.reason}`;
}

function selectContract(
  contracts: LoopGovernanceContract[],
  loopId?: string
): LoopGovernanceContract {
  if (contracts.length === 0) {
    throw new Error("Loop controller config has no contracts.");
  }

  if (loopId) {
    const contract = contracts.find((candidate) => candidate.loopId === loopId);

    if (!contract) {
      throw new Error(`Loop controller contract not found: ${loopId}`);
    }

    return contract;
  }

  if (contracts.length !== 1) {
    throw new Error("Loop controller config has multiple contracts; pass loopId.");
  }

  return contracts[0];
}

function resolveLaneRules(
  contract: LoopGovernanceContract,
  laneRules?: LoopControllerLaneRule[]
): LoopControllerLaneRule[] {
  if (laneRules && laneRules.length > 0) {
    return laneRules;
  }

  if (contract.allowedLanes.length === 1) {
    return contract.allowedPaths.map((pathPrefix) => ({
      pathPrefix,
      lane: contract.allowedLanes[0]
    }));
  }

  throw new Error("Loop controller requires laneRules for multi-lane contracts.");
}

async function defaultReadTextFile(path: string): Promise<string> {
  return readFile(path, "utf8");
}

async function defaultGitStatusText(repoRoot: string): Promise<string> {
  const { stdout } = await execFileAsync("git", ["status", "--short", "--ignored"], {
    cwd: repoRoot,
    encoding: "utf8"
  });

  return stdout;
}

export async function evaluateLocalLoopController(
  input: LocalLoopControllerInput
): Promise<LocalLoopControllerOutput> {
  const readTextFile = input.readTextFile ?? defaultReadTextFile;
  const configPath = input.configPath ?? "project-os-loop.yaml";
  const configText = input.configText ?? await readTextFile(join(input.repoRoot, configPath));
  const config = parseLoopGovernanceConfig(configText);
  const contract = selectContract(config.contracts, input.loopId);
  const laneRules = resolveLaneRules(contract, input.laneRules);
  const statusSource = input.gitStatusText === undefined ? "git" : "supplied";
  const gitStatusText = input.gitStatusText ??
    await (input.getGitStatusText ?? defaultGitStatusText)(input.repoRoot);
  const { checkpoint, classification } = createLoopCheckpointFromGitStatus({
    contract,
    gitStatusShortIgnored: gitStatusText,
    laneRules,
    iterationId: input.iterationId,
    evidenceRefs: input.evidenceRefs ?? [],
    classifiedIgnoredResiduePaths: input.classifiedIgnoredResiduePaths ?? [],
    claimStatus: input.claimStatus,
    nextAction: input.nextAction ?? ""
  });
  const decision = evaluateIteration({ contract, checkpoint });

  return {
    loopId: contract.loopId,
    branchOrWorktree: contract.branchOrWorktree,
    iterationId: input.iterationId,
    statusSource,
    classification,
    checkpoint,
    decision,
    humanSummary: formatHumanSummary(decision)
  };
}
