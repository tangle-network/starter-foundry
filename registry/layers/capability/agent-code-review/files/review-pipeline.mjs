export const reviewer = {
  name: "code-reviewer",

  async analyzeDiff(diff) {
    console.log(`[review] analyzing ${diff.files?.length ?? 0} changed files`);
    return { findings: [] };
  },

  async checkRules(file, rules) {
    console.log(`[review] checking ${rules.length} rules on ${file.path}`);
    return { violations: [] };
  },

  async generateComments(findings) {
    return findings.map((f) => ({
      path: f.file,
      line: f.line,
      severity: f.severity,
      body: f.message,
    }));
  },
};
