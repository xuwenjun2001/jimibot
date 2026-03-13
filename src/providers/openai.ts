import type { ToolSchemaDefinition } from "../agent/tools/base.js";
import {
  LLMProvider,
  LLMResponse,
  type ChatMessage,
  type ChatOptions,
  type LLMUsage,
  type ToolCallRequest,
} from "./base.js";

// OpenAI-compatible Provider 的初始化配置。
// fetchImpl 保留为可注入，方便测试时完全脱离网络。
export interface OpenAIProviderOptions {
  apiKey?: string;
  apiBase?: string;
  defaultModel?: string;
  fetchImpl?: typeof fetch;
}

// 发给 OpenAI-compatible /chat/completions 的最小请求体。
// 这里只描述当前项目实际会用到的字段，不追求覆盖厂商全部能力。
interface OpenAIChatRequestBody {
  model: string;
  messages: ChatMessage[];
  max_tokens: number;
  temperature?: number;
  reasoning_effort?: string;
  tools?: ToolSchemaDefinition[];
  tool_choice?: "auto";
}

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_API_BASE = "https://api.openai.com/v1";
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.7;
// OpenAI 直连模式下允许透传的消息键集合。
// 其余字段会在基类的 sanitizeRequestMessages 中被裁掉。
const OPENAI_ALLOWED_MSG_KEYS = new Set([
  "role",
  "content",
  "tool_calls",
  "tool_call_id",
  "name",
]);

// 一个最小可用的 OpenAI-compatible Provider。
// 它的职责是把我方统一的 ChatOptions 翻译成 HTTP 请求，
// 再把厂商响应翻译回统一的 LLMResponse。
export class OpenAIProvider extends LLMProvider {
  private readonly defaultModel: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAIProviderOptions = {}) {
    super(options.apiKey, options.apiBase ?? DEFAULT_API_BASE);
    this.defaultModel = options.defaultModel ?? DEFAULT_MODEL;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async chat(options: ChatOptions): Promise<LLMResponse> {
    // model 允许调用方临时覆盖；没传时走 provider 默认模型。
    const model = options.model ?? this.defaultModel;
    const body = this.buildRequestBody(options, model);

    try {
      // 这里直接用 fetch，是为了先做一个不依赖第三方 SDK 的最小实现。
      const response = await this.fetchImpl(this.getChatCompletionsUrl(), {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify(body),
      });

      // HTTP 非 2xx 时，不抛异常给上层，而是统一包装成 error 响应。
      // 这样 AgentLoop 后面可以像处理普通模型回复一样处理错误信息。
      if (!response.ok) {
        const errorText = await response.text();
        return new LLMResponse({
          content: `OpenAI API Error ${response.status}: ${errorText}`,
          finishReason: "error",
        });
      }

      const payload = (await response.json()) as unknown;
      return this.parseResponse(payload);
    } catch (error) {
      // 网络异常、JSON 解析异常等都统一转成 LLMResponse，
      // 避免 Provider 层把异常风格泄漏到上层。
      const message = error instanceof Error ? error.message : String(error);
      return new LLMResponse({
        content: `Error calling OpenAI: ${message}`,
        finishReason: "error",
      });
    }
  }

  getDefaultModel(): string {
    return this.defaultModel;
  }

  // 统一生成 chat completions 端点地址。
  // apiBase 允许切到代理网关、自建兼容服务或测试环境。
  private getChatCompletionsUrl(): string {
    const base = this.apiBase ?? DEFAULT_API_BASE;
    const normalizedBase = base.endsWith("/") ? base : `${base}/`;
    return new URL("chat/completions", normalizedBase).toString();
  }

  // 统一构造请求头。
  // 对 OpenAI-compatible 服务来说，最常见的认证方式仍然是 Bearer Token。
  private buildHeaders(): HeadersInit {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.apiKey !== undefined && this.apiKey.length > 0) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  // 构造请求体时会做两层标准化：
  // 1. 先修空内容，避免 provider 因空字符串/空文本块报错
  // 2. 再裁剪字段，只保留 OpenAI-compatible 协议允许的键
  private buildRequestBody(
    options: ChatOptions,
    model: string,
  ): OpenAIChatRequestBody {
    const sanitizedMessages = LLMProvider.sanitizeRequestMessages(
      LLMProvider.sanitizeEmptyContent(options.messages),
      OPENAI_ALLOWED_MSG_KEYS,
    );

    const body: OpenAIChatRequestBody = {
      model,
      messages: sanitizedMessages,
      // max_tokens 至少为 1，避免调用方误传 0 或负数时被服务端直接拒绝。
      max_tokens: Math.max(1, options.maxTokens ?? DEFAULT_MAX_TOKENS),
    };

    // 这里显式补默认值，确保请求体在测试环境和生产环境都保持稳定。
    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    } else {
      body.temperature = DEFAULT_TEMPERATURE;
    }

    if (options.reasoningEffort !== undefined && options.reasoningEffort !== null) {
      body.reasoning_effort = options.reasoningEffort;
    }

    // 只要带 tools，就默认让模型自动决定是否调用。
    if (options.tools !== undefined) {
      body.tools = options.tools;
      body.tool_choice = "auto";
    }

    return body;
  }

  // 解析 OpenAI-compatible 响应。
  // 这里的原则是：外部 JSON 一律先按 unknown 看待，再逐步做运行时收窄。
  private parseResponse(payload: unknown): LLMResponse {
    if (!isRecord(payload)) {
      return new LLMResponse({
        content: "Error parsing OpenAI response: payload is not an object",
        finishReason: "error",
      });
    }

    // choices[0] 是当前最小实现里唯一消费的候选回复。
    const choices = Array.isArray(payload.choices) ? payload.choices : [];
    const firstChoice = choices[0];
    if (!isRecord(firstChoice)) {
      return new LLMResponse({
        content: "Error parsing OpenAI response: missing choices[0]",
        finishReason: "error",
      });
    }

    const message = isRecord(firstChoice.message) ? firstChoice.message : {};
    // 把厂商原始 tool_calls 翻译成我方统一 ToolCallRequest。
    const toolCalls = extractToolCalls(message.tool_calls);
    // usage 字段也在这里统一成内部 camelCase 形态。
    const usage = extractUsage(payload.usage);
    const content = typeof message.content === "string" ? message.content : null;
    const reasoningContent =
      typeof message.reasoning_content === "string"
        ? message.reasoning_content
        : null;

    return new LLMResponse({
      content,
      toolCalls,
      finishReason:
        typeof firstChoice.finish_reason === "string"
          ? firstChoice.finish_reason
          : "stop",
      usage,
      reasoningContent,
    });
  }
}

// 解析 OpenAI-compatible tool_calls。
// 厂商响应里 function.arguments 常常是 JSON 字符串，这里统一做展开。
function extractToolCalls(value: unknown): ToolCallRequest[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const toolCalls: ToolCallRequest[] = [];
  for (const item of value) {
    if (!isRecord(item)) {
      continue;
    }

    const id = typeof item.id === "string" ? item.id : "";
    const fn = isRecord(item.function) ? item.function : null;
    const name = fn !== null && typeof fn.name === "string" ? fn.name : "";
    const args = fn !== null ? parseToolArguments(fn.arguments) : {};

    if (id && name) {
      toolCalls.push({
        id,
        name,
        arguments: args,
      });
    }
  }

  return toolCalls;
}

// 兼容两种参数形态：
// 1. 已经是对象
// 2. JSON 字符串
// 如果字符串解析失败，则保留原文，方便排查模型生成了什么非法参数。
function parseToolArguments(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (isRecord(parsed)) {
      return parsed;
    }
    return { value: parsed };
  } catch {
    return { _raw: value };
  }
}

// 把 OpenAI 风格的 snake_case usage 翻译成内部 camelCase。
function extractUsage(value: unknown): LLMUsage {
  if (!isRecord(value)) {
    return {};
  }

  const usage: LLMUsage = {};
  if (typeof value.prompt_tokens === "number") {
    usage.promptTokens = value.prompt_tokens;
  }
  if (typeof value.completion_tokens === "number") {
    usage.completionTokens = value.completion_tokens;
  }
  if (typeof value.total_tokens === "number") {
    usage.totalTokens = value.total_tokens;
  }
  return usage;
}

// OpenAIProvider 自己也需要一层 object 收窄，避免直接信任第三方 JSON。
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
