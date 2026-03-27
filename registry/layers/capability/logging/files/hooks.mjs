export default {
  onRequest(request) {
    console.log(`[request] ${request.method} ${request.url}`);
  },
  beforeCycle(tick) {
    console.log(`[cycle:start] ${tick.symbol}`);
  },
  afterCycle(tick) {
    console.log(`[cycle:end] ${tick.symbol}`);
  }
};
