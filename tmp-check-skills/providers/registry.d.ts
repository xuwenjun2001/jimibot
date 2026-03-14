import { LLMProvider } from "./base.js";
import { type MockProviderOptions } from "./mock.js";
import { type OpenAIProviderOptions } from "./openai.js";
export interface ProviderSpec<TOptions = unknown> {
    name: string;
    keywords: readonly string[];
    create(options?: TOptions): LLMProvider;
}
export declare class ProviderRegistry {
    private readonly providers;
    constructor(specs?: readonly ProviderSpec[]);
    register(spec: ProviderSpec): void;
    has(name: string): boolean;
    list(): string[];
    get(name: string): ProviderSpec | undefined;
    create(name: string, options?: unknown): LLMProvider;
    findByModel(model: string): ProviderSpec | undefined;
    createForModel(model: string, options?: unknown): LLMProvider;
}
export declare const BUILTIN_PROVIDER_SPECS: readonly [{
    readonly name: "mock";
    readonly keywords: readonly ["mock"];
    readonly create: (options?: MockProviderOptions) => LLMProvider;
}, {
    readonly name: "openai";
    readonly keywords: readonly ["openai", "gpt"];
    readonly create: (options?: OpenAIProviderOptions) => LLMProvider;
}];
export declare const defaultProviderRegistry: ProviderRegistry;
//# sourceMappingURL=registry.d.ts.map