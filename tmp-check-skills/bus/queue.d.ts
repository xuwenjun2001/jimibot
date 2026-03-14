import { type InboundMessage, type OutboundMessage } from "./events.js";
type InboundHandler = (message: InboundMessage) => Promise<void>;
type OutboundHandler = (message: OutboundMessage) => Promise<void>;
export declare class MessageBus {
    private readonly emitter;
    /**
     * 提醒监听器，inbound事件已触发，可以进行消费
     * @param msg
     */
    publishInbound(msg: InboundMessage): void;
    /**
     * 提醒监听器，outbound事件已触发，可以进行消费
     * @param msg
     */
    publishOutbound(msg: OutboundMessage): void;
    /**
     * 注册一个inbound事件监听器，在收到入站消息时触发
     * @param handler
     */
    onInbound(handler: InboundHandler): void;
    /**
     * 注册一个outbound事件监听器，在收到出站消息时触发
     * @param handler
     */
    onOutbound(handler: OutboundHandler): void;
}
export {};
//# sourceMappingURL=queue.d.ts.map