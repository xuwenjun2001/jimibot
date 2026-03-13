import { MessageBus } from "../bus/queue.js";
import { BaseChannel } from "./base.js";
// 测试/联调用的假通道。
// 它不连接真实平台，只负责：
// 1. 记录 send() 收到的出站消息
// 2. 提供 simulateInboundMessage() 模拟平台来消息
// 这样后续即使还没有真实 Telegram/Discord 接入，也能先把整条业务链跑通。
export class MockChannel extends BaseChannel {
    channelName;
    // 记录所有“本该发到平台”的消息，方便测试断言。
    sentMessages = [];
    // 记录模拟过的入站输入，便于排查测试流量。
    inboundEvents = [];
    // 生命周期日志主要用于测试 start/stop 是否被正确调用。
    startLogs = [];
    stopLogs = [];
    constructor(channelName, config, bus) {
        super(config, bus);
        this.channelName = channelName;
    }
    get name() {
        return this.channelName;
    }
    async start() {
        // 真实通道以后可能在这里建立 websocket、轮询或 webhook。
        // MockChannel 只需要切状态并留下可观察痕迹。
        this.setRunning(true);
        this.startLogs.push(`start:${this.name}`);
    }
    async stop() {
        // 真实通道以后会在这里清理连接和监听器。
        this.setRunning(false);
        this.stopLogs.push(`stop:${this.name}`);
    }
    async send(message) {
        // 模拟“已经发给平台”，所以只记录，不真正联网。
        this.sentMessages.push(message);
    }
    async simulateInboundMessage(input) {
        // 这相当于“平台 SDK 回调我收到了一条消息”。
        this.inboundEvents.push(input);
        // 继续走基类模板方法，确保 mock 和真实通道走的是同一套入站流程。
        this.handleMessage(input);
    }
}
//# sourceMappingURL=mock.js.map