import {} from "./events.js";
import { EventEmitter } from "node:events";
export class MessageBus {
    emitter = new EventEmitter(); //注册监听器
    /**
     * 提醒监听器，inbound事件已触发，可以进行消费
     * @param msg
     */
    publishInbound(msg) {
        this.emitter.emit("inbound", msg);
    }
    /**
     * 提醒监听器，outbound事件已触发，可以进行消费
     * @param msg
     */
    publishOutbound(msg) {
        this.emitter.emit("outbound", msg);
    }
    /**
     * 注册一个inbound事件监听器，在收到入站消息时触发
     * @param handler
     */
    onInbound(handler) {
        this.emitter.on("inbound", (msg) => {
            void handler(msg);
        });
    }
    /**
     * 注册一个outbound事件监听器，在收到出站消息时触发
     * @param handler
     */
    onOutbound(handler) {
        this.emitter.on("outbound", (msg) => {
            void handler(msg);
        });
    }
}
//# sourceMappingURL=queue.js.map