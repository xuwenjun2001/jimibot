declare const SESSION_ROLES: readonly ["user", "assistant", "tool"];
export type SessionRole = (typeof SESSION_ROLES)[number];
export interface SessionMessage {
    role: SessionRole;
    content: string;
    timestamp: string;
    tool_calls?: Record<string, unknown>[];
    tool_call_id?: string;
    name?: string;
}
export interface SessionMessageInput {
    role: SessionRole;
    content: string;
    timestamp?: string;
    tool_calls?: Record<string, unknown>[];
    tool_call_id?: string;
    name?: string;
}
export interface Session {
    sessionKey: string;
    createdAt: string;
    updatedAt: string;
    lastConsolidated: number;
    metadata: Record<string, unknown>;
    messages: SessionMessage[];
}
export interface SessionInput {
    sessionKey: string;
    createdAt?: string;
    updatedAt?: string;
    lastConsolidated?: number;
    metadata?: Record<string, unknown>;
    messages?: SessionMessage[];
}
export declare function isSessionRole(value: unknown): value is SessionRole;
export declare function isSessionMessage(value: unknown): value is SessionMessage;
export declare function createSessionMessage(input: SessionMessageInput): SessionMessage;
export declare function createSession(input: SessionInput): Session;
export {};
//# sourceMappingURL=types.d.ts.map