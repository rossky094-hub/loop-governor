import YAML from "yaml";
import { z } from "zod";
import {
  ActiveLoopRecordSchema,
  isAllowedPath,
  LoopGovernanceContractSchema
} from "./loop-governance.js";

export const LoopGovernanceConfigSchema = z.object({
  contracts: z.array(LoopGovernanceContractSchema).default([]),
  activeLoops: z.array(ActiveLoopRecordSchema).default([])
}).strict();

export type LoopGovernanceConfig = z.infer<typeof LoopGovernanceConfigSchema>;

export interface LoopGovernanceConfigValidationResult {
  ok: boolean;
  errors: string[];
}

function hasYamlContent(yamlText: string): boolean {
  return yamlText.split(/\r?\n/).some((line) => {
    const trimmedLine = line.trim();

    return trimmedLine !== "" && !trimmedLine.startsWith("#");
  });
}

export function parseLoopGovernanceConfig(yamlText: string): LoopGovernanceConfig {
  if (!hasYamlContent(yamlText)) {
    return LoopGovernanceConfigSchema.parse({});
  }

  return LoopGovernanceConfigSchema.parse(YAML.parse(yamlText));
}

function formatLoopGovernanceConfigError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (/Nested mappings|compact mappings|bad indentation|YAML/i.test(message)) {
    return [
      "Loop Governor config YAML parse failed.",
      "Hint: quote strings that contain punctuation such as ':' or '#'.",
      `Parser detail: ${message}`
    ].join(" ");
  }

  return message;
}

export function validateLoopGovernanceConfigText(
  yamlText: string
): LoopGovernanceConfigValidationResult {
  try {
    const config = parseLoopGovernanceConfig(yamlText);

    if (config.contracts.length === 0) {
      return {
        ok: false,
        errors: ["Loop Governor config must define at least one contract."]
      };
    }

    const invalidAllowedPath = config.contracts
      .flatMap((contract) => contract.allowedPaths)
      .find((allowedPath) => !isAllowedPath(allowedPath, [allowedPath]));

    if (invalidAllowedPath) {
      return {
        ok: false,
        errors: [`Invalid contract allowedPaths path: ${invalidAllowedPath}`]
      };
    }

    return { ok: true, errors: [] };
  } catch (error) {
    return {
      ok: false,
      errors: [formatLoopGovernanceConfigError(error)]
    };
  }
}
