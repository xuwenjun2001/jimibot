import { LLMProvider } from "./base.js";
import { MockProvider, type MockProviderOptions } from "./mock.js";
import { OpenAIProvider, type OpenAIProviderOptions } from "./openai.js";

// Provider 注册项。
// 它描述“一个 Provider 叫什么、适配哪些模型关键字、如何实例化”。
export interface ProviderSpec<TOptions = unknown> {
  name: string;
  keywords: readonly string[];
  create(options?: TOptions): LLMProvider;
}

// 最小 Provider 注册中心。
// mission6 先做到这一步就足够：可注册、可列出、可按名字创建、可按模型关键字匹配。
export class ProviderRegistry {
  private readonly providers = new Map<string, ProviderSpec>();

  constructor(specs: readonly ProviderSpec[] = []) {
    for (const spec of specs) {
      this.register(spec);
    }
  }

  register(spec: ProviderSpec): void {
    this.providers.set(spec.name, spec);
  }

  // 用于外层快速判断某个 Provider 名称是否已经注册。
  has(name: string): boolean {
    return this.providers.has(name);
  }

  // 返回已注册 Provider 名称，便于状态页、调试日志或配置校验使用。
  list(): string[] {
    return [...this.providers.keys()].sort();
  }

  get(name: string): ProviderSpec | undefined {
    return this.providers.get(name);
  }

  // 按名称实例化 Provider。
  // 这是后续接配置系统、AgentLoop 时最直接的入口。
  create(name: string, options?: unknown): LLMProvider {
    const spec = this.providers.get(name);
    if (spec === undefined) {
      throw new Error(`Unknown provider: ${name}`);
    }

    return spec.create(options);
  }

  // 按模型名关键字做一个最小路由。
  // 例如 gpt-* 自动命中 openai；mock-model 命中 mock。
  findByModel(model: string): ProviderSpec | undefined {
    const normalizedModel = model.toLowerCase();

    for (const spec of this.providers.values()) {
      if (spec.keywords.some((keyword) => normalizedModel.includes(keyword))) {
        return spec;
      }
    }

    return undefined;
  }

  // 直接按模型创建 Provider。
  // 这给后续“provider=auto，按模型自动选”打下了基础。
  createForModel(model: string, options?: unknown): LLMProvider {
    const spec = this.findByModel(model);
    if (spec === undefined) {
      throw new Error(`No provider matches model: ${model}`);
    }

    return spec.create(options);
  }
}

// 当前项目内置的 Provider 列表。
// mission6 先只放 mock 和 openai，后续新增 Provider 时继续往这里补即可。
export const BUILTIN_PROVIDER_SPECS = [
  {
    name: "mock",
    keywords: ["mock"],
    create(options?: MockProviderOptions): LLMProvider {
      return new MockProvider(options);
    },
  },
  {
    name: "openai",
    keywords: ["openai", "gpt"],
    create(options?: OpenAIProviderOptions): LLMProvider {
      return new OpenAIProvider(options);
    },
  },
] as const satisfies readonly ProviderSpec[];

// 默认注册中心，方便外层直接拿来用，不必每次手动 new + register。
export const defaultProviderRegistry = new ProviderRegistry(
  BUILTIN_PROVIDER_SPECS,
);
