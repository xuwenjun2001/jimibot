import assert from "node:assert/strict";
import { LLMProvider, LLMResponse, } from "./base.js";
class DummyProvider extends LLMProvider {
    async chat(_options) {
        return new LLMResponse({ content: "ok" });
    }
    getDefaultModel() {
        return "dummy-model";
    }
}
const provider = new DummyProvider("test-key", "https://example.com");
assert.equal(provider.getDefaultModel(), "dummy-model");
const noToolResponse = new LLMResponse({ content: "hello" });
assert.equal(noToolResponse.hasToolCalls, false);
const withToolResponse = new LLMResponse({
    content: null,
    toolCalls: [
        {
            id: "call_1",
            name: "read_file",
            arguments: { path: "README.md" },
        },
    ],
});
assert.equal(withToolResponse.hasToolCalls, true);
const messages = [
    {
        role: "user",
        content: "",
    },
    {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "call_1" }],
    },
    {
        role: "assistant",
        content: [
            { type: "text", text: "" },
            { type: "image_url", image_url: "https://example.com/a.png" },
        ],
    },
    {
        role: "tool",
        content: {
            type: "output_text",
            text: "done",
        },
    },
];
const sanitized = LLMProvider.sanitizeEmptyContent(messages);
assert.equal(sanitized[0]?.content, "(empty)");
assert.equal(sanitized[1]?.content, null);
assert.deepEqual(sanitized[2]?.content, [
    { type: "image_url", image_url: "https://example.com/a.png" },
]);
assert.deepEqual(sanitized[3]?.content, [
    { type: "output_text", text: "done" },
]);
const requestMessages = LLMProvider.sanitizeRequestMessages([
    {
        role: "assistant",
        tool_calls: [{ id: "call_1" }],
        reasoning_content: "hidden",
        extra_key: "drop me",
    },
], new Set(["role", "content", "tool_calls", "reasoning_content"]));
assert.deepEqual(requestMessages, [
    {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_1" }],
        reasoning_content: "hidden",
    },
]);
console.log("Mission 6 base provider checks passed.");
//# sourceMappingURL=base.test.js.map