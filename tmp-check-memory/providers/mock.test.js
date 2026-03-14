import assert from "node:assert/strict";
import { Tool } from "../agent/tools/base.js";
import { MockProvider } from "./mock.js";
class EchoTool extends Tool {
    get name() {
        return "echo";
    }
    get description() {
        return "Echo the input text.";
    }
    get parameters() {
        return {
            type: "object",
            properties: {
                text: {
                    type: "string",
                },
            },
            required: ["text"],
        };
    }
    async execute(params) {
        return String(params.text ?? "");
    }
}
const tool = new EchoTool();
const provider = new MockProvider({
    defaultModel: "mock-gpt",
    responses: [
        {
            content: null,
            toolCalls: [
                {
                    id: "call_1",
                    name: "echo",
                    arguments: { text: "hello" },
                },
            ],
            finishReason: "tool_calls",
        },
    ],
    fallbackResponse: {
        content: "fallback",
    },
});
const firstResponse = await provider.chat({
    messages: [
        {
            role: "user",
            content: "",
        },
    ],
    tools: [tool.toSchema()],
});
assert.equal(firstResponse.hasToolCalls, true);
assert.equal(firstResponse.finishReason, "tool_calls");
assert.equal(provider.requests.length, 1);
assert.equal(provider.requests[0]?.model, "mock-gpt");
assert.equal(provider.requests[0]?.maxTokens, 4096);
assert.equal(provider.requests[0]?.temperature, 0.7);
assert.equal(provider.requests[0]?.reasoningEffort, null);
assert.equal(provider.requests[0]?.messages[0]?.content, "(empty)");
assert.deepEqual(provider.requests[0]?.tools, [tool.toSchema()]);
provider.enqueueResponse({
    content: "queued second response",
});
const secondResponse = await provider.chat({
    messages: [
        {
            role: "assistant",
            content: "",
            tool_calls: [{ id: "call_2" }],
        },
    ],
    model: "override-model",
    maxTokens: 512,
    temperature: 0.2,
    reasoningEffort: "medium",
});
assert.equal(secondResponse.content, "queued second response");
assert.equal(provider.requests[1]?.model, "override-model");
assert.equal(provider.requests[1]?.maxTokens, 512);
assert.equal(provider.requests[1]?.temperature, 0.2);
assert.equal(provider.requests[1]?.reasoningEffort, "medium");
assert.equal(provider.requests[1]?.messages[0]?.content, null);
const thirdResponse = await provider.chat({
    messages: [
        {
            role: "user",
            content: "hello again",
        },
    ],
});
assert.equal(thirdResponse.content, "fallback");
assert.equal(provider.getDefaultModel(), "mock-gpt");
console.log("Mission 6 mock provider checks passed.");
//# sourceMappingURL=mock.test.js.map