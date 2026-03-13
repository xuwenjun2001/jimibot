import { LLMProvider } from "./base.js";
import { MockProvider } from "./mock.js";
import { OpenAIProvider } from "./openai.js";
export class ProviderRegistry {
    providers = new Map();
    constructor(specs = []) {
        for (const spec of specs) {
            this.register(spec);
        }
    }
    register(spec) {
        this.providers.set(spec.name, spec);
    }
    has(name) {
        return this.providers.has(name);
    }
    list() {
        return [...this.providers.keys()].sort();
    }
    get(name) {
        return this.providers.get(name);
    }
    create(name, options) {
        const spec = this.providers.get(name);
        if (spec === undefined) {
            throw new Error(`Unknown provider: ${name}`);
        }
        return spec.create(options);
    }
    findByModel(model) {
        const normalizedModel = model.toLowerCase();
        for (const spec of this.providers.values()) {
            if (spec.keywords.some((keyword) => normalizedModel.includes(keyword))) {
                return spec;
            }
        }
        return undefined;
    }
    createForModel(model, options) {
        const spec = this.findByModel(model);
        if (spec === undefined) {
            throw new Error(`No provider matches model: ${model}`);
        }
        return spec.create(options);
    }
}
export const BUILTIN_PROVIDER_SPECS = [
    {
        name: "mock",
        keywords: ["mock"],
        create(options) {
            return new MockProvider(options);
        },
    },
    {
        name: "openai",
        keywords: ["openai", "gpt"],
        create(options) {
            return new OpenAIProvider(options);
        },
    },
];
export const defaultProviderRegistry = new ProviderRegistry(BUILTIN_PROVIDER_SPECS);
//# sourceMappingURL=registry.js.map