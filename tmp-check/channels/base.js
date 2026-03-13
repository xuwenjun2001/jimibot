import { createInboundMessage, } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
export class BaseChannel {
    config;
    bus;
    running = false;
    constructor(config, bus) {
        this.config = config;
        this.bus = bus;
    }
    isAllowed(senderId) {
        if (this.config.allowFrom.length === 0) {
            return false;
        }
        if (this.config.allowFrom.includes("*")) {
            return true;
        }
        return this.config.allowFrom.includes(String(senderId));
    }
    get isRunning() {
        return this.running;
    }
    setRunning(running) {
        this.running = running;
    }
    handleMessage(input) {
        if (!this.isAllowed(input.senderId)) {
            return;
        }
        const messageInput = {
            channel: this.name,
            senderId: String(input.senderId),
            chatId: String(input.chatId),
            content: input.content,
        };
        if (input.timestamp !== undefined) {
            messageInput.timestamp = input.timestamp;
        }
        if (input.media !== undefined) {
            messageInput.media = input.media;
        }
        if (input.metadata !== undefined) {
            messageInput.metadata = input.metadata;
        }
        if (input.sessionKeyOverride !== undefined) {
            messageInput.sessionKeyOverride = input.sessionKeyOverride;
        }
        const message = createInboundMessage(messageInput);
        this.bus.publishInbound(message);
    }
}
//# sourceMappingURL=base.js.map