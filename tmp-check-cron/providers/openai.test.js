import assert from "node:assert/strict";
import { Tool } from "../agent/tools/base.js";
import { OpenAIProvider } from "./openai.js";
class EchoTool extends Tool {
    get name() {
        return "echo";
    }
    get description() {
        return "Echo text.";
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
let capturedUrl = "";
let capturedInit;
const provider = new OpenAIProvider({
    apiKey: "test-key",
    apiBase: "https://api.example.com/v1",
    defaultModel: "gpt-test",
    fetchImpl: async (input, init) => {
        capturedUrl = String(input);
        capturedInit = init;
        return new Response(JSON.stringify({
            choices: [
                {
                    message: {
                        content: "hello from provider",
                        reasoning_content: "hidden summary",
                        tool_calls: [
                            {
                                id: "call_1",
                                function: {
                                    name: "echo",
                                    arguments: "{\"text\":\"hello\"}",
                                },
                            },
                        ],
                    },
                    finish_reason: "tool_calls",
                },
            ],
            usage: {
                prompt_tokens: 12,
                completion_tokens: 8,
                total_tokens: 20,
            },
        }), {
            status: 200,
            headers: {
                "Content-Type": "application/json",
            },
        });
    },
});
const tool = new EchoTool();
const response = await provider.chat({
    messages: [
        {
            role: "assistant",
            tool_calls: [{ id: "call_1", type: "function" }],
            reasoning_content: "should be stripped from request",
            extra_key: "drop me",
        },
        {
            role: "user",
            content: "",
        },
    ],
    tools: [tool.toSchema()],
    reasoningEffort: "medium",
});
assert.equal(capturedUrl, "https://api.example.com/v1/chat/completions");
assert.equal(capturedInit?.method, "POST");
assert.equal((capturedInit?.headers).Authorization, "Bearer test-key");
const requestBody = JSON.parse(String(capturedInit?.body));
assert.equal(requestBody.model, "gpt-test");
assert.equal(requestBody.max_tokens, 4096);
assert.equal(requestBody.temperature, 0.7);
assert.equal(requestBody.reasoning_effort, "medium");
assert.equal(requestBody.tool_choice, "auto");
assert.deepEqual(requestBody.messages, [
    {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call_1", type: "function" }],
    },
    {
        role: "user",
        content: "(empty)",
    },
]);
assert.equal(response.content, "hello from provider");
assert.equal(response.finishReason, "tool_calls");
assert.equal(response.reasoningContent, "hidden summary");
assert.equal(response.usage.promptTokens, 12);
assert.equal(response.hasToolCalls, true);
assert.deepEqual(response.toolCalls, [
    {
        id: "call_1",
        name: "echo",
        arguments: {
            text: "hello",
        },
    },
]);
const errorProvider = new OpenAIProvider({
    fetchImpl: async () => new Response("bad request", {
        status: 400,
    }),
});
const errorResponse = await errorProvider.chat({
    messages: [
        {
            role: "user",
            content: "hello",
        },
    ],
});
assert.equal(errorResponse.content, "OpenAI API Error 400: bad request");
assert.equal(errorResponse.finishReason, "error");
console.log("Mission 6 OpenAI provider checks passed.");
//# sourceMappingURL=openai.test.js.map