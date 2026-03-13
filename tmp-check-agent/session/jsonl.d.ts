import { type SessionMessage } from "./types.js";
export declare function getSessionsDir(workspacePath: string): string;
export declare function sessionKeyToFilename(sessionKey: string): string;
export declare function getSessionFilePath(workspacePath: string, sessionKey: string): string;
export declare function ensureSessionsDir(workspacePath: string): Promise<string>;
export declare function appendSessionMessage(workspacePath: string, sessionKey: string, message: SessionMessage): Promise<string>;
export declare function writeSessionMessages(workspacePath: string, sessionKey: string, messages: SessionMessage[]): Promise<string>;
export declare function readSessionMessages(workspacePath: string, sessionKey: string): Promise<SessionMessage[]>;
//# sourceMappingURL=jsonl.d.ts.map