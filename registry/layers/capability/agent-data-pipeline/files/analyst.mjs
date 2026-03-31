export const analyst = {
  name: "data-analyst",

  async questionToSql(question, schema) {
    console.log(`[analyst] converting question: ${question.slice(0, 80)}`);
    return { sql: null, explanation: "not implemented" };
  },

  async executeQuery(sql, dataSource) {
    console.log(`[analyst] executing query on ${dataSource.name}`);
    return { rows: [], columns: [], rowCount: 0 };
  },

  async formatOutput(results, format) {
    console.log(`[analyst] formatting ${results.rowCount} rows as ${format}`);
    return { output: null, format };
  },
};
