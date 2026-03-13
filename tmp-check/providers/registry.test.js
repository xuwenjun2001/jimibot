import assert from "node:assert/strict";
import { MockProvider } from "./mock.js";
import { OpenAIProvider } from "./openai.js";
import { BUILTIN_PROVIDER_SPECS, ProviderRegistry, defaultProviderRegistry, } from "./registry.js";
assert.equal(BUILTIN_PROVIDER_SPECS.length >= 2, true);
assert.deepEqual(defaultProviderRegistry.list(), ["mock", "openai"]);
const openaiSpec = defaultProviderRegistry.findByModel("gpt-4o-mini");
assert.equal(openaiSpec?.name, "openai");
const mockSpec = defaultProviderRegistry.findByModel("mock-model");
assert.equal(mockSpec?.name, "mock");
const openaiProvider = defaultProviderRegistry.create("openai", {
    apiKey: "test-key",
    apiBase: "https://api.example.com/v1",
    defaultModel: "gpt-test",
});
assert.equal(openaiProvider instanceof OpenAIProvider, true);
const modelMatchedProvider = defaultProviderRegistry.createForModel("gpt-4.1", {
    defaultModel: "gpt-4.1",
});
assert.equal(modelMatchedProvider instanceof OpenAIProvider, true);
const mockProvider = defaultProviderRegistry.create("mock", {
    defaultModel: "mock-gpt",
});
assert.equal(mockProvider instanceof MockProvider, true);
const registry = new ProviderRegistry();
registry.register({
    name: "custom",
    keywords: ["custom"],
    create: () => new MockProvider({ defaultModel: "custom-model" }),
});
assert.equal(registry.has("custom"), true);
assert.equal(registry.findByModel("custom-model")?.name, "custom");
assert.equal(registry.create("custom") instanceof MockProvider, true);
assert.throws(() => defaultProviderRegistry.create("missing"), /Unknown provider: missing/);
assert.throws(() => defaultProviderRegistry.createForModel("claude-sonnet"), /No provider matches model: claude-sonnet/);
console.log("Mission 6 provider registry checks passed.");
//# sourceMappingURL=registry.test.js.map