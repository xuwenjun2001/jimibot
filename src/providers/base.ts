import type { ToolSchemaDefinition } from "../agent/tools/base.js";

// Provider 层处在“我方业务对象”和“第三方 LLM API”之间，
// 这里的数据经常是半结构化的，所以先统一用宽松对象表示。
type JsonObject = Record<string, unknown>;

// 统一后的工具调用请求。
// 不管底层是 OpenAI、LiteLLM 还是别的协议，交给上层前都要整理成这个形状。
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: JsonObject;
}

// 不同 Provider 对 token usage 的返回并不稳定，所以这里全部做成可选字段。
export interface LLMUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

// 多模态内容块的最小公共结构。
// 这里只保留 Provider 层真正会关心的公共字段，避免过早绑定某一家厂商的完整协议。
export interface ChatContentBlock extends JsonObject {
  type?: string;
  text?: unknown;
}

// Provider 层允许的消息内容类型：
// 1. 纯文本
// 2. 明确无内容（null）
// 3. 多模态 block 数组
// 4. 单个对象（后续会在 sanitize 阶段被标准化为数组）
export type ChatMessageContent =
  | string
  | null
  | ChatContentBlock[]
  | JsonObject;

// 这是发给 LLM 的“边界消息对象”。
// 注意这里故意保留 tool_calls / tool_call_id 等 snake_case，
// 因为它已经非常接近外部 API 协议，继续转 camelCase 只会增加无意义映射成本。
export interface ChatMessage extends JsonObject {
  role: string;
  content?: ChatMessageContent;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
  reasoning_content?: string;
  thinking_blocks?: JsonObject[];
}

// 所有 Provider 对外暴露的统一入参。
// AgentLoop 以后只需要构造这个对象，不需要关心底下接的是哪家模型。
export interface ChatOptions {
  messages: ChatMessage[];
  tools?: ToolSchemaDefinition[];
  model?: string;
  maxTokens?: number;
  temperature?: number;
  reasoningEffort?: string | null;
}

// LLMResponse 的构造参数。
// 这里允许传“半成品”，由 LLMResponse 构造器补齐默认值，避免调用方重复处理空数组/默认状态。
export interface LLMResponseInit {
  content: string | null;
  toolCalls?: ToolCallRequest[];
  finishReason?: string;
  usage?: LLMUsage;
  reasoningContent?: string | null;
  thinkingBlocks?: JsonObject[] | null;
}

// Provider 层返回给上层业务的统一响应对象。
// 这层的目标是把“厂商差异”吸收掉，让上层只面对稳定结构。
export class LLMResponse {
  readonly content: string | null;
  readonly toolCalls: ToolCallRequest[];
  readonly finishReason: string;
  readonly usage: LLMUsage;
  readonly reasoningContent: string | null;
  readonly thinkingBlocks: JsonObject[] | null;

  constructor(init: LLMResponseInit) {
    this.content = init.content;
    this.toolCalls = init.toolCalls ?? [];
    this.finishReason = init.finishReason ?? "stop";
    this.usage = init.usage ?? {};
    this.reasoningContent = init.reasoningContent ?? null;
    this.thinkingBlocks = init.thinkingBlocks ?? null;
  }

  // 等价于 Python 原版的 @property。
  // 对上层来说，hasToolCalls 是一个“状态”而不是“动作”，所以 getter 比方法更自然。
  get hasToolCalls(): boolean {
    return this.toolCalls.length > 0;
  }
}

// 运行时类型守卫：把外部不可信的 unknown 收窄成我方标准 ToolCallRequest。
// 这在解析第三方响应时非常重要，不能直接假设外部 JSON 一定合法。
export function isToolCallRequest(value: unknown): value is ToolCallRequest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    isRecord(value.arguments)
  );
}

// 所有具体 Provider 的抽象基类。
// 它负责两件事：
// 1. 规定统一接口（chat / getDefaultModel）
// 2. 提供所有 Provider 都会复用的公共清洗逻辑
export abstract class LLMProvider {
  protected readonly apiKey: string | undefined;
  protected readonly apiBase: string | undefined;

  constructor(apiKey?: string, apiBase?: string) {
    this.apiKey = apiKey;
    this.apiBase = apiBase;
  }

  // 统一清洗“空内容”：
  // 某些工具执行后可能返回空字符串或空文本块，而很多 LLM API 会因此直接报 400。
  // 这里在发请求前做一次标准化，避免每个 Provider 各写一套相同的补丁逻辑。
  static sanitizeEmptyContent(
    messages: readonly ChatMessage[],
  ): ChatMessage[] {
    return messages.map((message) => {
      const content = message.content;

      // 普通空字符串改成 "(empty)"，避免被当成非法空内容。
      // 但 assistant + tool_calls 是一个特例：这类消息允许 content 为 null。
      if (typeof content === "string" && content.length === 0) {
        return {
          ...message,
          content: shouldUseNullContent(message) ? null : "(empty)",
        };
      }

      if (Array.isArray(content)) {
        // 多模态数组里可能混入空 text block，这类 block 对业务没有价值，
        // 但会让部分 Provider 拒绝请求，所以先在边界层剔除。
        const filtered = content.filter((item) => !isEmptyTextBlock(item));

        if (filtered.length !== content.length) {
          return {
            ...message,
            content:
              filtered.length > 0
                ? filtered
                : shouldUseNullContent(message)
                  ? null
                  : "(empty)",
          };
        }
      }

      // 某些上游可能传来单个对象形式的 content。
      // 这里统一包装成数组，方便后续 Provider 直接按 block 列表处理。
      if (isRecord(content)) {
        return {
          ...message,
          content: [content],
        };
      }

      return { ...message };
    });
  }

  // 统一裁剪请求消息字段。
  // 很多 Provider 对未知字段很敏感，这里只保留“当前 Provider 明确允许的键”，
  // 避免把调试字段、内部字段或别家协议字段误发出去。
  static sanitizeRequestMessages(
    messages: readonly ChatMessage[],
    allowedKeys: ReadonlySet<string>,
  ): ChatMessage[] {
    return messages.map((message) => {
      const clean: ChatMessage = { role: message.role };

      for (const [key, value] of Object.entries(message)) {
        if (allowedKeys.has(key)) {
          clean[key] = value;
        }
      }

      // 一些 Provider 要求 assistant 消息即使没有正文，也必须显式带 content: null，
      // 不能只是“缺这个字段”。
      if (clean.role === "assistant" && !("content" in clean)) {
        clean.content = null;
      }

      return clean;
    });
  }

  abstract chat(options: ChatOptions): Promise<LLMResponse>;

  abstract getDefaultModel(): string;
}

// 判断一个值是不是普通对象。
// 这是处理 unknown 的第一层防线：要排除 null 和数组。
function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// 判断一个对象是否“看起来像”多模态文本块。
// 这里故意做弱判断，只识别 Provider 层真正依赖的 type 字段。
function isTextBlock(value: unknown): value is ChatContentBlock {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.type === "string";
}

// 判断一个文本块是否属于“空块”：
// 只要是 text/input_text/output_text 且 text 为空，就认为需要被清理。
function isEmptyTextBlock(value: unknown): boolean {
  if (!isTextBlock(value)) {
    return false;
  }

  const { type, text } = value;
  if (typeof type !== "string") {
    return false;
  }

  return (
    isTextBlockType(type) &&
    (text === "" || text === null || text === undefined)
  );
}

// 当前 Provider 层统一认定为“文本内容”的 block 类型集合。
function isTextBlockType(type: string): boolean {
  return (
    type === "text" ||
    type === "input_text" ||
    type === "output_text"
  );
}

// assistant + tool_calls 是一个特殊业务场景：
// 模型只是发起工具调用，没有自然语言正文，这时 content 为 null 才是正确表达。
function shouldUseNullContent(message: ChatMessage): boolean {
  return (
    message.role === "assistant" &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  );
}
