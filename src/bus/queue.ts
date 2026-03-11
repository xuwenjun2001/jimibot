import { type InboundMessage, type OutboundMessage } from "./events.js";
import { EventEmitter } from "node:events";

type InboundHandler = (message: InboundMessage) => Promise<void>;
type OutboundHandler = (message: OutboundMessage) => Promise<void>;

export class MessageBus {
  private readonly emitter = new EventEmitter(); //注册监听器
  /**
   * 提醒监听器，inbound事件已触发，可以进行消费
   * @param msg
   */
  publishInbound(msg: InboundMessage): void {
    this.emitter.emit("inbound", msg);
  }

  /**
   * 提醒监听器，outbound事件已触发，可以进行消费
   * @param msg
   */
  publishOutbound(msg: OutboundMessage): void {
    this.emitter.emit("outbound", msg);
  }

  /**
   * 注册一个inbound事件监听器，在收到入站消息时触发
   * @param handler
   */
  onInbound(handler: InboundHandler): void {
    this.emitter.on("inbound", (msg: InboundMessage) => {
      void handler(msg);
    });
  }

  /**
   * 注册一个outbound事件监听器，在收到出站消息时触发
   * @param handler
   */
  onOutbound(handler: OutboundHandler): void {
    this.emitter.on("outbound", (msg: OutboundMessage) => {
      void handler(msg);
    });
  }
}
