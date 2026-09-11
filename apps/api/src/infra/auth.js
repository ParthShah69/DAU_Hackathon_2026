const { DomainError } = require('../domain/errors');

function actorFromRequest(store, request) {
  const userId = request.headers['x-demo-user'] || 'user-buyer';
  const user = store.findOne('users', (item) => item.id === userId);
  if (!user) throw new DomainError('UNAUTHENTICATED', 'Demo user was not found', 401);
  const memberships = store.findMany('memberships', (item) => item.userId === userId);
  const requestedOrganizationId = request.headers['x-demo-organization'];
  const membership = memberships.find((item) => !requestedOrganizationId || item.organizationId === requestedOrganizationId);
  if (!membership) throw new DomainError('FORBIDDEN', 'User is not a member of the selected organization', 403);
  const organization = store.findOne('organizations', (item) => item.id === membership.organizationId);
  return {
    userId,
    user,
    organizationId: membership.organizationId,
    organization,
    roles: membership.roles || []
  };
}

function requireRole(actor, roles) {
  if (!roles.some((role) => actor.roles.includes(role))) {
    throw new DomainError('FORBIDDEN', `This action requires one of: ${roles.join(', ')}`, 403);
  }
}

module.exports = { actorFromRequest, requireRole };
