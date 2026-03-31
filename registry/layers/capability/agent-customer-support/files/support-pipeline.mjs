export const pipeline = {
  name: "customer-support",

  async classifyIntent(message) {
    console.log(`[support] classifying: ${message.slice(0, 80)}`);
    return { intent: "unknown", confidence: 0 };
  },

  async searchKb(intent, query) {
    console.log(`[support] searching KB for: ${query}`);
    return { articles: [], confidence: 0 };
  },

  async generateResponse(intent, kbResults, history) {
    console.log(`[support] generating response for intent: ${intent}`);
    return { response: null, shouldEscalate: false };
  },

  async escalate(ticket, reason) {
    console.log(`[support] escalating ticket: ${reason}`);
    return { escalated: true, channel: "human-queue" };
  },
};
