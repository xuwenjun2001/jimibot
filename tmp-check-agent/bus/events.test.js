import assert from "node:assert/strict";
import { createInboundMessage, createOutboundMessage, getSessionKey, } from "./events.js";
const inbound = createInboundMessage({
    channel: "telegram",
    senderId: "114514",
    chatId: "1919",
    content: "Hello!",
});
assert.equal(inbound.timestamp instanceof Date, true);
assert.equal(getSessionKey(inbound), "telegram:1919");
const threadedInbound = createInboundMessage({
    channel: "telegram",
    senderId: "114514",
    chatId: "1919",
    sessionKeyOverride: "telegram:1919:thread-1",
    content: "Threaded hello!",
});
assert.equal(getSessionKey(threadedInbound), "telegram:1919:thread-1");
const outbound = createOutboundMessage({
    channel: "telegram",
    chatId: "1919",
    content: "Hello!",
});
assert.deepEqual(outbound, {
    channel: "telegram",
    chatId: "1919",
    content: "Hello!",
    media: [],
    metadata: {},
});
console.log("Message bus event checks passed.");
//# sourceMappingURL=events.test.js.map