import { MessageBus } from "../bus/queue.js";
import { BaseChannel } from "./base.js";
export class MockChannel extends BaseChannel {
    channelName;
    sentMessages = [];
    inboundEvents = [];
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
        this.setRunning(true);
        this.startLogs.push(`start:${this.name}`);
    }
    async stop() {
        this.setRunning(false);
        this.stopLogs.push(`stop:${this.name}`);
    }
    async send(message) {
        this.sentMessages.push(message);
    }
    async simulateInboundMessage(input) {
        this.inboundEvents.push(input);
        this.handleMessage(input);
    }
}
//# sourceMappingURL=mock.js.map