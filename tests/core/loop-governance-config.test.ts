import { readFileSync } from "node:fs";
import { join } from "node:path";
const { describe, expect, it } = await import("vit" + "est");
import {
  parseLoopGovernanceConfig,
  validateLoopGovernanceConfigText
} from "../../src/core/loop-governance-config.js";

const validContractYaml = `
version: loop-governor-exploration.v0.1
loopId: loop:phase-1-task-3
parentGoal: Explore branch-only Loop Governor rails.
objective: Parse the loop governance YAML config.
allowedLanes:
  - core
allowedPaths:
  - src/core/loop-governance-config.ts
  - tests/core/loop-governance-config.test.ts
branchOrWorktree: loop-governor-exploration
`;

describe("parseLoopGovernanceConfig", () => {
  it("parses project-os-loop YAML into typed contracts and active loops", () => {
    const config = parseLoopGovernanceConfig(`
contracts:
  - ${validContractYaml.trim().replace(/\n/g, "\n    ")}
activeLoops:
  - loopId: loop:parallel-core-task
    allowedPaths:
      - src/core/parallel-task.ts
    branchOrWorktree: parallel-worktree
    remainingBudget: 3
`);

    expect(config.contracts).toHaveLength(1);
    expect(config.contracts[0]).toMatchObject({
      version: "loop-governor-exploration.v0.1",
      loopId: "loop:phase-1-task-3",
      allowedLanes: ["core"],
      policy: "strict"
    });
    expect(config.activeLoops).toEqual([
      {
        loopId: "loop:parallel-core-task",
        allowedPaths: ["src/core/parallel-task.ts"],
        branchOrWorktree: "parallel-worktree",
        remainingBudget: 3
      }
    ]);
  });

  it("defaults missing contracts and active loops to empty arrays", () => {
    expect(parseLoopGovernanceConfig("{}")).toEqual({
      contracts: [],
      activeLoops: []
    });
  });

  it("defaults empty text to empty arrays", () => {
    expect(parseLoopGovernanceConfig("")).toEqual({
      contracts: [],
      activeLoops: []
    });
  });

  it("defaults comments-only text to empty arrays", () => {
    expect(parseLoopGovernanceConfig(`
# Project-local loop config can be absent while the file is being introduced.
# Comments alone should behave like no config.
`)).toEqual({
      contracts: [],
      activeLoops: []
    });
  });

  it.each(["null", "~"])("rejects explicit YAML null value %s", (yamlText: string) => {
    expect(() => parseLoopGovernanceConfig(yamlText)).toThrow();
  });

  it("rejects stale v3.14-loop-governor contract labels", () => {
    expect(() => parseLoopGovernanceConfig(`
contracts:
  - ${validContractYaml.trim().replace(
    "version: loop-governor-exploration.v0.1",
    "version: v3.14-loop-governor"
  ).replace(/\n/g, "\n    ")}
`)).toThrow();
  });

  it("rejects unknown top-level keys", () => {
    expect(() => parseLoopGovernanceConfig(`
contracts: []
activeLoops: []
persistentRegistry: runtime/loops.json
`)).toThrow();
  });

  it.each([
    "../src/core/foo.ts",
    "/repo/src/core/foo.ts"
  ])("rejects unsafe active loop path %s", (unsafePath: string) => {
    expect(() => parseLoopGovernanceConfig(`
activeLoops:
  - loopId: loop:unsafe-path
    allowedPaths:
      - ${unsafePath}
`)).toThrow();
  });

  it("throws when YAML syntax is invalid", () => {
    expect(() => parseLoopGovernanceConfig("contracts: [")).toThrow();
  });
});

describe("validateLoopGovernanceConfigText", () => {
  const validValidationYaml = `
contracts:
  - version: loop-governor-exploration.v0.1
    loopId: "loop:contract-validation"
    parentGoal: "Validate contract authoring."
    objective: "Validate a narrow controller-only contract."
    allowedLanes:
      - "docs"
    allowedPaths:
      - "docs/"
    branchOrWorktree: "loop-governor-contract-authoring-hardening"
activeLoops: []
`;

  it("returns ok true for a valid controller-only contract", () => {
    expect(validateLoopGovernanceConfigText(validValidationYaml)).toEqual({
      ok: true,
      errors: []
    });
  });

  it("parses the controller-only contract template", () => {
    const text = readFileSync(
      join(process.cwd(), "examples/docs-only/project-os-loop.yaml"),
      "utf8"
    );

    expect(validateLoopGovernanceConfigText(text)).toEqual({
      ok: true,
      errors: []
    });
  });

  it("returns ok false when no contracts are defined", () => {
    const result = validateLoopGovernanceConfigText(`
contracts: []
activeLoops: []
`);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/contract/i);
  });

  it.each([
    ["empty text", ""],
    ["comments-only text", "# controller contract goes here\n# still missing"]
  ])("returns ok false for %s", (_: string, yamlText: string) => {
    const result = validateLoopGovernanceConfigText(yamlText);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/contract/i);
  });

  it("returns ok false for unquoted colon YAML", () => {
    const result = validateLoopGovernanceConfigText(`
contracts:
  - version: loop-governor-exploration.v0.1
    loopId: "loop:bad-colon"
    parentGoal: "Validate contract authoring."
    objective: Run checks: one allowed docs edit
    allowedLanes:
      - "docs"
    allowedPaths:
      - "docs/"
    branchOrWorktree: "loop-governor-contract-authoring-hardening"
`);

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toContain("Loop Governor config YAML parse failed.");
    expect(result.errors.join("\n")).toContain("quote strings that contain punctuation");
    expect(result.errors.join("\n")).toMatch(/Nested mappings|compact mappings|colon/i);
  });

  it("returns ok false for stale contract version", () => {
    const result = validateLoopGovernanceConfigText(
      validValidationYaml.replace(
        "loop-governor-exploration.v0.1",
        "v3.14-loop-governor"
      )
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/version|v3\.14/i);
  });

  it("returns ok false for empty allowed paths", () => {
    const result = validateLoopGovernanceConfigText(
      validValidationYaml.replace('      - "docs/"', "")
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/allowedPaths/i);
  });

  it("returns ok false for empty allowed lanes", () => {
    const result = validateLoopGovernanceConfigText(
      validValidationYaml.replace('      - "docs"', "")
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/allowedLanes/i);
  });

  it("returns ok false for explicit null config", () => {
    const result = validateLoopGovernanceConfigText("null");

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/null|object/i);
  });

  it("returns ok false for malformed cannot claim entries", () => {
    const result = validateLoopGovernanceConfigText(validValidationYaml.replace(
      '    branchOrWorktree: "loop-governor-contract-authoring-hardening"',
      `    cannotClaim:
      - text: ""
        scope: final_claim
        severity: boundary
    branchOrWorktree: "loop-governor-contract-authoring-hardening"`
    ));

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/cannotClaim|text/i);
  });

  it("returns ok false for unsafe absolute path", () => {
    const result = validateLoopGovernanceConfigText(
      validValidationYaml.replace("docs/", "/repo/docs/")
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/path|absolute|allowedPaths/i);
  });

  it("returns ok false for parent traversal path", () => {
    const result = validateLoopGovernanceConfigText(
      validValidationYaml.replace("docs/", "../outside/")
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join("\n")).toMatch(/path|outside|allowedPaths/i);
  });
});
