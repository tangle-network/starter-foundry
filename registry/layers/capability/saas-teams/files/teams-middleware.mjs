export default {
  async resolveTeam(request) {
    const teamId = request.headers["x-team-id"] ?? null;
    console.log(`[teams] resolving team: ${teamId}`);
    return { teamId, role: null, permissions: [] };
  },

  checkPermission(role, requiredPermission) {
    if (!role) return false;
    if (role.permissions.includes("*")) return true;
    return role.permissions.includes(requiredPermission);
  },

  async createInvitation(teamId, email, role) {
    console.log(`[teams] inviting ${email} to ${teamId} as ${role}`);
    return { token: null, expiresAt: null };
  },
};
