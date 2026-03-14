import { createInboundMessage, } from "../bus/events.js";
import { MessageBus } from "../bus/queue.js";
// 所有聊天平台通道的抽象基类。
// 这层的职责是把“平台共性”收口：
// 1. 生命周期接口（start/stop）
// 2. 出站发送接口（send）
// 3. 权限检查
// 4. 入站消息模板流程（平台消息 -> 内部消息 -> MessageBus）
export class BaseChannel {
    config;
    bus;
    // 运行状态由基类统一持有，具体通道只负责在 start/stop 时更新它。
    running = false;
    constructor(config, bus) {
        this.config = config;
        this.bus = bus;
    }
    // 最小权限模型：
    // 空白名单 = 全拒绝
    // "*" = 全允许
    // 其他情况按 senderId 精确匹配
    // 这个判断发生在“平台消息进入系统之前”。
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
    // 只允许子类修改运行状态，外部只能读，不能直接写。
    setRunning(running) {
        this.running = running;
    }
    // 模板方法：具体平台通道只需要负责“提取平台字段”，
    // 剩下的权限检查、内部消息组装、发布到总线都在这里统一完成。
    handleMessage(input) {
        if (!this.isAllowed(input.senderId)) {
            return;
        }
        // 先构造最小必填字段，再按需补可选字段。
        // 这样写是为了兼容 exactOptionalPropertyTypes：
        // 可选字段不能显式传 undefined，只能在值存在时再挂上去。
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
        // 到这里为止，平台原始消息已经被翻译成系统内部统一消息。
        const message = createInboundMessage(messageInput);
        // 通道层不直接调用 AgentLoop，而是统一交给 MessageBus，
        // 由总线把通道层和后续业务层解耦开。
        this.bus.publishInbound(message);
    }
}
//# sourceMappingURL=base.js.map