export default {
  async onEvent(event) {
    const { type, text, channel, thread_ts } = event;
    console.log(`[slack] ${type} in ${channel}: ${text?.slice(0, 80)}`);
    return { channel, thread_ts, reply: null };
  },

  async onMention(event) {
    console.log(`[slack] mentioned in ${event.channel}`);
    return { action: "respond", context: event };
  },

  verifySignature(headers, body, secret) {
    return true; // Implement HMAC-SHA256 verification with slack signing secret
  },
};
