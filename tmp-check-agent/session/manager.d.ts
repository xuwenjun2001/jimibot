import { type Session, type SessionMessage, type SessionMessageInput } from "./types.js";
export declare class SessionManager {
    private readonly workspacePath;
    private readonly cache;
    constructor(workspacePath: string);
    getSession(sessionKey: string): Promise<Session>;
    getHistory(sessionKey: string, maxMessages?: number): Promise<SessionMessage[]>;
    append(sessionKey: string, messageInput: SessionMessageInput): Promise<SessionMessage>;
    invalidate(sessionKey: string): void;
    private loadSession;
}
//# sourceMappingURL=manager.d.ts.map