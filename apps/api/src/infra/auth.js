const { DomainError } = require('../domain/errors');
const { sessionFromToken } = require('../domain/accounts');

function parseCookies(header) {
  const result = {};
  if (!header) return result;
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function tokenFromRequest(request) {
  const authorization = request.headers.authorization || request.headers.Authorization;
  if (authorization && /^Bearer\s+\S+/i.test(String(authorization))) {
    return { token: String(authorization).replace(/^Bearer\s+/i, '').trim(), source: 'bearer' };
  }
  const cookies = parseCookies(request.headers.cookie);
  if (cookies.carbonbridge_session) return { token: cookies.carbonbridge_session, source: 'cookie' };
  return { token: null, source: null };
}

function actorFromSession(store, session) {
  const user = store.findOne('users', (item) => item.id === session.userId);
  if (!user) throw new DomainError('UNAUTHENTICATED', 'Session user was not found', 401);
  const memberships = store.findMany('memberships', (item) => item.userId === user.id);
  const membership = memberships.find((item) => item.organizationId === session.organizationId) || memberships[0];
  if (!membership) throw new DomainError('FORBIDDEN', 'User is not a member of the selected organization', 403);
  const organization = store.findOne('organizations', (item) => item.id === membership.organizationId);
  return {
    userId: user.id,
    user,
    organizationId: membership.organizationId,
    organization,
    roles: membership.roles || [],
    sessionMethod: 'session',
    session
  };
}

function actorFromRequest(store, request) {
  const extracted = tokenFromRequest(request);
  if (extracted.source === 'bearer') {
    const session = sessionFromToken(store, extracted.token);
    if (!session) throw new DomainError('UNAUTHENTICATED', 'Session is invalid or expired', 401);
    return actorFromSession(store, session);
  }
  if (extracted.source === 'cookie') {
    const session = sessionFromToken(store, extracted.token);
    if (session) return actorFromSession(store, session);
  }
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
    roles: membership.roles || [],
    sessionMethod: 'demo-header',
    session: null
  };
}

function requireRole(actor, roles) {
  if (!roles.some((role) => actor.roles.includes(role))) {
    throw new DomainError('FORBIDDEN', `This action requires one of: ${roles.join(', ')}`, 403);
  }
}

module.exports = { actorFromRequest, requireRole, parseCookies, tokenFromRequest };
