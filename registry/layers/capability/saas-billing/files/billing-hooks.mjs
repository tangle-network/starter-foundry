export default {
  async onSubscriptionCreated(event) {
    console.log(`[billing] subscription created: ${event.data.object.id}`);
    return { action: "provision-access" };
  },

  async onSubscriptionUpdated(event) {
    console.log(`[billing] subscription updated: ${event.data.object.id}`);
    return { action: "update-limits" };
  },

  async onSubscriptionCanceled(event) {
    console.log(`[billing] subscription canceled: ${event.data.object.id}`);
    return { action: "revoke-access" };
  },

  async onUsageReport(customerId, metric, quantity) {
    console.log(`[billing] usage: ${customerId} ${metric} +${quantity}`);
    return { recorded: true };
  },
};
