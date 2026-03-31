export const supervisor = {
  name: "orchestrator",

  async route(task, agents) {
    console.log(`[supervisor] routing task: ${task.type}`);
    const agent = agents.find((a) => a.role === task.assignTo) ?? agents[0];
    return { agent: agent.role, task };
  },

  async collect(results) {
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      console.log(`[supervisor] ${failed.length} subtasks failed, retrying`);
    }
    return { ok: failed.length === 0, results };
  },
};
