export default {
  async route(request, providers) {
    const provider = providers.find((p) =>
      request.headers[p.signatureHeader.toLowerCase()]
    );
    if (!provider) return { status: 400, error: "unknown provider" };
    console.log(`[webhook] routing to ${provider.id}`);
    return { provider: provider.id, verified: false, payload: null };
  },

  async process(provider, payload) {
    console.log(`[webhook] processing ${provider} event: ${payload.type ?? "unknown"}`);
    return { handled: false };
  },
};
