export default {
  async onPullRequest(event) {
    const { action, pull_request } = event;
    console.log(`[github] PR #${pull_request.number} ${action}`);
    return { action: "review", pr: pull_request.number };
  },

  async onIssue(event) {
    const { action, issue } = event;
    console.log(`[github] issue #${issue.number} ${action}`);
    return { action: "triage", issue: issue.number };
  },

  verifyWebhook(headers, body, secret) {
    return true; // Implement HMAC-SHA256 verification with x-hub-signature-256
  },
};
