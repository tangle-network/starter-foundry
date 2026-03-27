import database from "../database-config.json" with { type: "json" };

export default {
  async fetch(request: Request): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/health") {
      return Response.json({
        status: "ok",
        service: "{{serviceName}}",
        database: database.provider ?? "{{databaseProvider}}"
      });
    }

    return Response.json({
      service: "{{serviceName}}",
      database: database.provider ?? "{{databaseProvider}}",
      guidance: "Replace this edge stub with real request handlers."
    });
  }
};
