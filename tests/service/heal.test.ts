import { describe, expect, it } from "vite-plus/test";
import type { AiPort } from "../../src/ports";
import { createHealService } from "../../src/service/healService";
import type { SourceService } from "../../src/service/sourceService";

const issueJson = JSON.stringify({
  issues: [
    {
      description: "label is wrong",
      severity: "warning",
      fix: { kind: "jsx-attribute", component: "Button", name: "label", value: "Fixed" },
    },
    { description: "advisory only", severity: "info", fix: null },
  ],
});

function fakeSource() {
  return {
    read: async () => ({
      content: 'export const Button = () => <button label="Old" />;',
      hash: "h",
    }),
    propose: async (input: { filePath: string }) => ({
      patch: { filePath: input.filePath, baseHash: "h", afterHash: "h2", edits: [] },
      preview: "patched",
    }),
  } as unknown as SourceService;
}

describe("healService", () => {
  it("proposes AST patches from vision issues and skips advisory ones", async () => {
    const calls: string[] = [];
    const ai: AiPort = {
      run: async (model) => {
        calls.push(model);
        return { response: issueJson };
      },
    };
    const heal = createHealService({ ai, source: fakeSource() });
    const result = await heal.run({
      filePath: "src/components/Button.tsx",
      goal: "fix the label",
      image: "data:image/png;base64,aGVsbG8=",
      component: "Button",
    });
    expect(calls[0]).toContain("vision");
    expect(result.issues.length).toBe(2);
    expect(result.patches.length).toBe(1);
    expect(result.patches[0].description).toBe("label is wrong");
  });

  it("falls back to text audit when no image is provided", async () => {
    const calls: string[] = [];
    const ai: AiPort = {
      run: async (model) => {
        calls.push(model);
        return { response: issueJson };
      },
    };
    const heal = createHealService({ ai, source: fakeSource() });
    const result = await heal.run({ filePath: "src/components/Button.tsx", goal: "fix" });
    expect(calls.every((model) => !model.includes("vision"))).toBe(true);
    expect(result.patches.length).toBe(1);
  });

  it("survives malformed model output", async () => {
    const ai: AiPort = { run: async () => ({ response: "not json at all" }) };
    const heal = createHealService({ ai, source: fakeSource() });
    const result = await heal.run({ filePath: "src/components/Button.tsx", goal: "fix" });
    expect(result.issues).toEqual([]);
    expect(result.patches).toEqual([]);
  });
});
