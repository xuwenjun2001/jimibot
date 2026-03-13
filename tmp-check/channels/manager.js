import { MessageBus } from "../bus/queue.js";
import { BaseChannel } from "./base.js";
export class ChannelManager {
    config;
    bus;
    factories;
    channels = new Map();
    outboundSubscribed = false;
    constructor(config, bus, factories = {}) {
        this.config = config;
        this.bus = bus;
        this.factories = factories;
        this.initializeChannels();
    }
    async startAll() {
        this.ensureOutboundSubscription();
        await Promise.all([...this.channels.values()].map(async (channel) => channel.start()));
    }
    async stopAll() {
        await Promise.all([...this.channels.values()].map(async (channel) => channel.stop()));
    }
    getChannel(name) {
        return this.channels.get(name);
    }
    get enabledChannels() {
        return [...this.channels.keys()];
    }
    getStatus() {
        return Object.fromEntries([...this.channels.entries()].map(([name, channel]) => [
            name,
            {
                enabled: true,
                running: channel.isRunning,
            },
        ]));
    }
    async routeOutboundMessage(message) {
        const channel = this.channels.get(message.channel);
        if (channel === undefined) {
            return false;
        }
        await channel.send(message);
        return true;
    }
    initializeChannels() {
        for (const [name, factory] of Object.entries(this.factories)) {
            if (factory === undefined) {
                continue;
            }
            const channelConfig = this.config.channels[name];
            if (channelConfig.enabled) {
                const channel = factory(channelConfig, this.bus);
                this.channels.set(String(name), channel);
            }
        }
    }
    ensureOutboundSubscription() {
        if (this.outboundSubscribed) {
            return;
        }
        this.outboundSubscribed = true;
        this.bus.onOutbound(async (message) => {
            await this.routeOutboundMessage(message);
        });
    }
}
//# sourceMappingURL=manager.js.map