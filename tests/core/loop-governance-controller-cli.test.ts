const { afterEach, describe, expect, it, vi } = await import("vit" + "est");
import {
  formatLoopControllerCliOutput,
  main,
  parseLoopControllerCliArgs
} from "../../src/loop-governance-controller-cli.js";

describe("parseLoopControllerCliArgs", () => {
  it("parses the required controller values", () => {
    expect(parseLoopControllerCliArgs([
      "--root", "/repo",
      "--config", "project-os-loop.yaml",
      "--loop-id", "loop:example",
      "--claim-status", "can-claim",
      "--iteration-id", "iteration:example"
    ])).toMatchObject({
      input: {
        repoRoot: "/repo",
        configPath: "project-os-loop.yaml",
        loopId: "loop:example",
        claimStatus: "can-claim",
        iterationId: "iteration:example"
      },
      summaryOnly: false
    });
  });

  it("parses JSON options and summary mode", () => {
    expect(parseLoopControllerCliArgs([
      "--lane-rules-json", JSON.stringify([{ pathPrefix: "docs/", lane: "docs" }]),
      "--evidence-json", JSON.stringify([{ id: "test:evidence", status: "satisfied" }]),
      "--classified-ignored-json", JSON.stringify(["node_modules/"]),
      "--next-action", "Review the wrapper output.",
      "--summary-only"
    ])).toMatchObject({
      input: {
        laneRules: [{ pathPrefix: "docs/", lane: "docs" }],
        evidenceRefs: [{ id: "test:evidence", status: "satisfied" }],
        classifiedIgnoredResiduePaths: ["node_modules/"],
        nextAction: "Review the wrapper output."
      },
      summaryOnly: true
    });
  });

  it("parses config-only validation mode", () => {
    expect(parseLoopControllerCliArgs([
      "--validate-config-only",
      "--config", "project-os-loop.yaml"
    ])).toMatchObject({
      configValidationOnly: true,
      input: {
        configPath: "project-os-loop.yaml"
      }
    });
  });

  it("rejects invalid claim status", () => {
    expect(parseLoopControllerCliArgs([
      "--claim-status", "done"
    ])).toMatchObject({
      error: expect.stringMatching(/claim-status/)
    });
  });

  it("rejects invalid JSON options", () => {
    expect(parseLoopControllerCliArgs([
      "--evidence-json", "{not-json"
    ])).toMatchObject({
      error: expect.stringMatching(/Invalid JSON.*--evidence-json/)
    });
  });
});

describe("formatLoopControllerCliOutput", () => {
  const output = {
    loopId: "loop:example",
    humanSummary: "CONTINUE: Loop iteration may continue."
  };

  it("prints summary only when requested", () => {
    expect(formatLoopControllerCliOutput({
      output: output as never,
      summaryOnly: true
    })).toBe("CONTINUE: Loop iteration may continue.");
  });

  it("prints formatted JSON by default", () => {
    expect(formatLoopControllerCliOutput({
      output: output as never,
      summaryOnly: false
    })).toBe(JSON.stringify(output, null, 2));
  });
});

describe("main", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns zero and prints output when evaluation succeeds", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const evaluate = vi.fn().mockResolvedValue({
      loopId: "loop:example",
      humanSummary: "CONTINUE: Loop iteration may continue."
    });

    const exitCode = await main([
      "--root", "/repo",
      "--config", "project-os-loop.yaml",
      "--claim-status", "can-claim",
      "--iteration-id", "iteration:example",
      "--summary-only"
    ], { evaluate });

    expect(exitCode).toBe(0);
    expect(evaluate).toHaveBeenCalledWith(expect.objectContaining({
      repoRoot: "/repo",
      configPath: "project-os-loop.yaml",
      claimStatus: "can-claim",
      iterationId: "iteration:example"
    }));
    expect(log).toHaveBeenCalledWith("CONTINUE: Loop iteration may continue.");
    expect(error).not.toHaveBeenCalled();
  });

  it("validates config without evaluating git status", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const evaluate = vi.fn();
    const readConfigText = vi.fn().mockResolvedValue("contracts: []");
    const validateConfigText = vi.fn().mockReturnValue({ ok: true, errors: [] });

    const exitCode = await main([
      "--validate-config-only",
      "--config", "project-os-loop.yaml"
    ], { evaluate, readConfigText, validateConfigText });

    expect(exitCode).toBe(0);
    expect(readConfigText).toHaveBeenCalledWith("project-os-loop.yaml");
    expect(validateConfigText).toHaveBeenCalledWith("contracts: []");
    expect(evaluate).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(JSON.stringify({ ok: true, errors: [] }, null, 2));
    expect(error).not.toHaveBeenCalled();
  });

  it("validates config relative to root", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const evaluate = vi.fn();
    const readConfigText = vi.fn().mockResolvedValue("contracts: []");
    const validateConfigText = vi.fn().mockReturnValue({ ok: true, errors: [] });

    const exitCode = await main([
      "--validate-config-only",
      "--root", "/measured",
      "--config", "project-os-loop.yaml"
    ], { evaluate, readConfigText, validateConfigText });

    expect(exitCode).toBe(0);
    expect(readConfigText).toHaveBeenCalledWith("/measured/project-os-loop.yaml");
    expect(evaluate).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(JSON.stringify({ ok: true, errors: [] }, null, 2));
  });

  it("returns non-zero JSON for invalid config-only validation", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const evaluate = vi.fn();
    const readConfigText = vi.fn().mockResolvedValue("contracts: [");
    const validateConfigText = vi.fn().mockReturnValue({
      ok: false,
      errors: ["YAML parse error"]
    });

    const exitCode = await main([
      "--validate-config-only",
      "--config", "project-os-loop.yaml"
    ], { evaluate, readConfigText, validateConfigText });

    expect(exitCode).toBe(2);
    expect(evaluate).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(JSON.stringify({
      ok: false,
      errors: ["YAML parse error"]
    }, null, 2));
  });

  it("returns two when evaluation throws", async () => {
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const evaluate = vi.fn().mockRejectedValue(new Error("config failed"));

    const exitCode = await main([], { evaluate });

    expect(exitCode).toBe(2);
    expect(error).toHaveBeenCalledWith("config failed");
  });
});
