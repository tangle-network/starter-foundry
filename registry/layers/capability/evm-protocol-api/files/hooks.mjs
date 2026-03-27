export default {
  onRequest(request) {
    console.log(`[protocol:${"{{protocolRole}}"}] ${request.method} ${request.url}`);
  },
  onProtocolTick(context) {
    console.log(`[protocol:scope] {{protocolScope}}:${context ?? "idle"}`);
  }
};
