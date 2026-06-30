import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import { validateLoopGovernanceConfigText } from "./core/loop-governance-config.js";
import {
  evaluateLocalLoopController,
  type LocalLoopControllerInput,
  type LocalLoopControllerOutput
} from "./core/loop-governance-local-controller.js";

const claimStatuses = ["can-claim", "cannot-claim", "needs-confirmation", "unknown"] as const;
const optionNames = new Set([
  "--root",
  "--config",
  "--loop-id",
  "--claim-status",
  "--iteration-id",
  "--status-text",
  "--lane-rules-json",
  "--evidence-json",
  "--classified-ignored-json",
  "--next-action"
]);

export interface ParsedLoopControllerCliArgs {
  input?: LocalLoopControllerInput;
  summaryOnly: boolean;
  configValidationOnly: boolean;
  error?: string;
}

export interface LoopControllerCliMainOptions {
  evaluate?: (input: LocalLoopControllerInput) => Promise<LocalLoopControllerOutput>;
  readConfigText?: (path: string) => Promise<string> | string;
  validateConfigText?: typeof validateLoopGovernanceConfigText;
}

function isClaimStatus(value: string): value is LocalLoopControllerInput["claimStatus"] {
  return (claimStatuses as readonly string[]).includes(value);
}

function readOptionValue(
  args: string[],
  index: number,
  option: string
): { value?: string; error?: string } {
  const value = args[index + 1];

  if (value === undefined || value.startsWith("--")) {
    return { error: `Missing value for ${option}` };
  }

  return { value };
}

function parseJsonOption<T>(option: string, value: string): { value?: T; error?: string } {
  try {
    return { value: JSON.parse(value) as T };
  } catch {
    return { error: `Invalid JSON for ${option}` };
  }
}

export function parseLoopControllerCliArgs(args: string[]): ParsedLoopControllerCliArgs {
  const input: Partial<LocalLoopControllerInput> = {
    repoRoot: ".",
    configPath: "project-os-loop.yaml",
    claimStatus: "needs-confirmation",
    iterationId: `iteration:${new Date().toISOString()}`
  };
  let summaryOnly = false;
  let configValidationOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--summary-only") {
      summaryOnly = true;
      continue;
    }

    if (arg === "--validate-config-only") {
      configValidationOnly = true;
      continue;
    }

    if (!optionNames.has(arg)) {
      return { summaryOnly, configValidationOnly, error: `Unknown option: ${arg}` };
    }

    const option = readOptionValue(args, index, arg);

    if (option.error) {
      return { summaryOnly, configValidationOnly, error: option.error };
    }

    index += 1;
    const value = option.value ?? "";

    if (arg === "--root") input.repoRoot = value;
    if (arg === "--config") input.configPath = value;
    if (arg === "--loop-id") input.loopId = value;
    if (arg === "--iteration-id") input.iterationId = value;
    if (arg === "--status-text") input.gitStatusText = value;
    if (arg === "--next-action") input.nextAction = value;

    if (arg === "--claim-status") {
      if (!isClaimStatus(value)) {
        return { summaryOnly, configValidationOnly, error: `Invalid --claim-status: ${value}` };
      }

      input.claimStatus = value;
    }

    if (arg === "--lane-rules-json") {
      const parsed = parseJsonOption<LocalLoopControllerInput["laneRules"]>(arg, value);
      if (parsed.error) return { summaryOnly, configValidationOnly, error: parsed.error };
      input.laneRules = parsed.value;
    }

    if (arg === "--evidence-json") {
      const parsed = parseJsonOption<LocalLoopControllerInput["evidenceRefs"]>(arg, value);
      if (parsed.error) return { summaryOnly, configValidationOnly, error: parsed.error };
      input.evidenceRefs = parsed.value;
    }

    if (arg === "--classified-ignored-json") {
      const parsed = parseJsonOption<LocalLoopControllerInput["classifiedIgnoredResiduePaths"]>(
        arg,
        value
      );
      if (parsed.error) return { summaryOnly, configValidationOnly, error: parsed.error };
      input.classifiedIgnoredResiduePaths = parsed.value;
    }
  }

  return {
    input: input as LocalLoopControllerInput,
    summaryOnly,
    configValidationOnly
  };
}

export function formatLoopControllerCliOutput(input: {
  output: LocalLoopControllerOutput;
  summaryOnly: boolean;
}): string {
  return input.summaryOnly
    ? input.output.humanSummary
    : JSON.stringify(input.output, null, 2);
}

export async function main(
  args = process.argv.slice(2),
  options: LoopControllerCliMainOptions = {}
): Promise<number> {
  const parsed = parseLoopControllerCliArgs(args);

  if (parsed.error || !parsed.input) {
    console.error(parsed.error ?? "Invalid loop controller arguments.");
    return 2;
  }

  try {
    if (parsed.configValidationOnly) {
      const readConfigText = options.readConfigText ?? ((path: string) => readFile(path, "utf8"));
      const validateConfigText = options.validateConfigText ?? validateLoopGovernanceConfigText;
      const configPathInput = parsed.input.configPath ?? "project-os-loop.yaml";
      const repoRoot = parsed.input.repoRoot ?? ".";
      const configPath = isAbsolute(configPathInput)
        ? configPathInput
        : join(repoRoot, configPathInput);
      const yamlText = await readConfigText(configPath);
      const result = validateConfigText(yamlText);

      console.log(JSON.stringify(result, null, 2));
      return result.ok ? 0 : 2;
    }

    const evaluate = options.evaluate ?? evaluateLocalLoopController;
    const output = await evaluate(parsed.input);
    console.log(formatLoopControllerCliOutput({ output, summaryOnly: parsed.summaryOnly }));
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const code = await main();
  process.exitCode = code;
}
