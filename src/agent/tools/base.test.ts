import assert from "node:assert/strict";

import type { ToolParametersSchema } from "../../types/schema.js";
import { Tool } from "./base.js";

class ExampleTool extends Tool {
  get name(): string {
    return "example_tool";
  }

  get description(): string {
    return "A small tool used to verify Tool base behavior.";
  }

  get parameters(): ToolParametersSchema {
    return {
      type: "object",
      properties: {
        path: {
          type: "string",
          minLength: 1,
        },
        timeout: {
          type: "integer",
          minimum: 1,
        },
        recursive: {
          type: "boolean",
        },
        tags: {
          type: "array",
          items: {
            type: "number",
          },
        },
        options: {
          type: "object",
          properties: {
            depth: {
              type: "integer",
              minimum: 0,
            },
            dryRun: {
              type: "boolean",
            },
          },
          required: ["depth"],
        },
      },
      required: ["path", "timeout"],
    };
  }

  async execute(params: Record<string, unknown>): Promise<string> {
    return JSON.stringify(params);
  }
}

const tool = new ExampleTool();

const castedParams = tool.castParams({
  path: 123,
  timeout: "60",
  recursive: "true",
  tags: ["1", "2.5"],
  options: {
    depth: "3",
    dryRun: "false",
  },
});

assert.deepEqual(castedParams, {
  path: "123",
  timeout: 60,
  recursive: true,
  tags: [1, 2.5],
  options: {
    depth: 3,
    dryRun: false,
  },
});

assert.deepEqual(tool.validateParams(castedParams), []);

const invalidParams = tool.castParams({
  path: "",
  timeout: "0",
  options: {},
  tags: ["oops"],
});

assert.deepEqual(tool.validateParams(invalidParams), [
  "path must be at least 1 chars",
  "timeout must be >= 1",
  "missing required options.depth",
  "tags[0] should be number",
]);

assert.deepEqual(tool.toSchema(), {
  type: "function",
  function: {
    name: "example_tool",
    description: "A small tool used to verify Tool base behavior.",
    parameters: tool.parameters,
  },
});

console.log(tool.validateParams(invalidParams));

const executeResult = await tool.execute(castedParams);

assert.equal(executeResult, JSON.stringify(castedParams));

console.log("Mission 3 tool base checks passed.");
