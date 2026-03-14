import type { InboundMessage } from "../bus/events.js";
import { type SessionMessage } from "./types.js";
export declare function createUserSessionMessageFromInbound(message: InboundMessage): SessionMessage;
export declare function createAssistantSessionMessage(content: string, timestamp?: string): SessionMessage;
export interface ToolSessionMessageInput {
    name: string;
    content: string;
    toolCallId?: string;
    timestamp?: string;
}
export declare function createToolSessionMessage(input: ToolSessionMessageInput): SessionMessage;
//# sourceMappingURL=adapters.d.ts.map