const { randomBytes, randomUUID, scryptSync, timingSafeEqual } = require('node:crypto');
const { DomainError, requireValue } = require('./errors');

const DEMO_PASSWORD = 'demo-pass-2026';
const SESSION_TTL_SECONDS = 604800;
const DEMO_ACTORS = [
  { userId: 'user-seller', email: 'seller@demo.carbonbridge.local' },
  { userId: 'user-buyer', email: 'buyer@demo.carbonbridge.local' },
  { userId: 'user-reviewer', email: 'reviewer@demo.carbonbridge.local' }
];

const KIND_CAPABILITIES = {
  supplier: ['supplier'],
  buyer: ['buyer'],
  ngo: ['ngo']
};

const KIND_ROLES = {
  supplier: ['org_admin', 'supplier_editor'],
  buyer: ['org_admin', 'buyer_editor'],
  ngo: ['org_admin', 'ngo_editor', 'reviewer']
};

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const passwordHash = scryptSync(String(password), salt, 64).toString('hex');
  return { passwordHash, salt };
}

function verifyPassword(password, record) {
  if (!record || !record.passwordHash || !record.salt) return false;
  const hashed = scryptSync(String(password), record.salt, 64);
  const stored = Buffer.from(record.passwordHash, 'hex');
  if (hashed.length !== stored.length) return false;
  return timingSafeEqual(hashed, stored);
}

function organizationKind(organization) {
  if (!organization) return null;
  if (organization.kind) return organization.kind;
  if (organization.capabilities?.includes('ngo')) return 'ngo';
  if (organization.capabilities?.includes('supplier')) return 'supplier';
  if (organization.capabilities?.includes('buyer')) return 'buyer';
  return null;
}

function publicUser(user) {
  return {
    id: user.id,
    displayName: user.displayName,
    email: user.email || null,
    externalSubject: user.externalSubject || null
  };
}

function publicOrganization(organization) {
  return {
    id: organization.id,
    name: organization.name,
    kind: organizationKind(organization),
    capabilities: organization.capabilities || [],
    status: organization.status || 'active'
  };
}

function publicMembership(membership) {
  return {
    organizationId: membership.organizationId,
    roles: membership.roles || []
  };
}

function publicSession(session) {
  return {
    id: session.id,
    token: session.token,
    userId: session.userId,
    organizationId: session.organizationId,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
  };
}

function createSession(store, { userId, organizationId, now = new Date() }) {
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
  return store.insert('sessions', {
    id: `session-${randomUUID()}`,
    token: randomBytes(32).toString('hex'),
    userId,
    organizationId,
    createdAt,
    expiresAt
  });
}

function sessionFromToken(store, token) {
  const value = String(token || '').trim();
  if (!value) return null;
  const session = store.findOne('sessions', (item) => item.token === value);
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt && new Date(session.expiresAt) <= new Date()) return null;
  return session;
}

function logout(store, token) {
  const session = sessionFromToken(store, token);
  if (!session) return { loggedOut: true };
  store.replace('sessions', session.id, { revokedAt: store.now(), expiresAt: store.now() });
  return { loggedOut: true };
}

function credentialByEmail(store, email) {
  const normalized = normalizeEmail(email);
  return store.findOne('credentials', (item) => normalizeEmail(item.email) === normalized) || null;
}

function actorPayload(store, { user, organization, membership, session }) {
  return {
    user: publicUser(user),
    organization: publicOrganization(organization),
    membership: publicMembership(membership),
    session: publicSession(session)
  };
}

function seedDemoAccounts(store) {
  for (const actor of DEMO_ACTORS) {
    const user = store.findOne('users', (item) => item.id === actor.userId);
    if (user && normalizeEmail(user.email) !== actor.email) {
      store.replace('users', user.id, { email: actor.email });
    }
    if (store.findOne('credentials', (item) => item.userId === actor.userId)) continue;
    const hashed = hashPassword(DEMO_PASSWORD);
    store.insert('credentials', {
      userId: actor.userId,
      email: actor.email,
      passwordHash: hashed.passwordHash,
      salt: hashed.salt
    });
  }
}

function register(store, { displayName, email, password, organizationName, organizationKind: kind, city, now = new Date() }) {
  const normalizedEmail = normalizeEmail(requireValue(email, 'email'));
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) throw new DomainError('VALIDATION_ERROR', 'email must be a valid address');
  if (credentialByEmail(store, normalizedEmail) || store.findOne('users', (item) => normalizeEmail(item.email) === normalizedEmail)) {
    throw new DomainError('CONFLICT', 'Email is already registered', 409);
  }
  const passwordValue = String(requireValue(password, 'password'));
  if (passwordValue.length < 8) throw new DomainError('VALIDATION_ERROR', 'password must be at least 8 characters');
  const organizationKindValue = String(requireValue(kind, 'organizationKind'));
  if (!KIND_CAPABILITIES[organizationKindValue]) throw new DomainError('VALIDATION_ERROR', 'organizationKind must be supplier, buyer or ngo');
  const name = String(requireValue(displayName, 'displayName')).trim().slice(0, 160);
  const orgName = String(requireValue(organizationName, 'organizationName')).trim().slice(0, 160);
  const timestamp = now.toISOString();
  const user = store.insert('users', {
    id: `user-${randomUUID()}`,
    displayName: name,
    email: normalizedEmail,
    externalSubject: `local:${normalizedEmail}`,
    createdAt: timestamp
  });
  const hashed = hashPassword(passwordValue);
  store.insert('credentials', { userId: user.id, email: normalizedEmail, passwordHash: hashed.passwordHash, salt: hashed.salt });
  const organization = store.insert('organizations', {
    id: `org-${randomUUID()}`,
    name: orgName,
    kind: organizationKindValue,
    capabilities: KIND_CAPABILITIES[organizationKindValue],
    status: 'active',
    synthetic: false,
    createdAt: timestamp
  });
  const membership = store.insert('memberships', {
    id: `membership-${randomUUID()}`,
    userId: user.id,
    organizationId: organization.id,
    roles: KIND_ROLES[organizationKindValue]
  });
  if (city) {
    store.insert('sites', {
      id: `site-${randomUUID()}`,
      organizationId: organization.id,
      label: `${orgName} site`,
      city: String(city).trim().slice(0, 120),
      latitude: null,
      longitude: null
    });
  }
  const session = createSession(store, { userId: user.id, organizationId: organization.id, now });
  return actorPayload(store, { user, organization, membership, session });
}

function login(store, { email, password, organizationId, now = new Date() }) {
  const credential = credentialByEmail(store, requireValue(email, 'email'));
  if (!credential || !verifyPassword(password, credential)) throw new DomainError('UNAUTHENTICATED', 'Email or password is incorrect', 401);
  const user = store.findOne('users', (item) => item.id === credential.userId);
  if (!user) throw new DomainError('UNAUTHENTICATED', 'Email or password is incorrect', 401);
  const memberships = store.findMany('memberships', (item) => item.userId === user.id);
  if (memberships.length === 0) throw new DomainError('FORBIDDEN', 'User has no organization membership', 403);
  const membership = organizationId
    ? memberships.find((item) => item.organizationId === organizationId)
    : memberships[0];
  if (!membership) throw new DomainError('FORBIDDEN', 'User is not a member of the selected organization', 403);
  const organization = store.findOne('organizations', (item) => item.id === membership.organizationId);
  if (!organization) throw new DomainError('NOT_FOUND', 'Organization was not found', 404);
  const session = createSession(store, { userId: user.id, organizationId: organization.id, now });
  return actorPayload(store, { user, organization, membership, session });
}

function listDemoActors(store) {
  const demoIds = new Set(DEMO_ACTORS.map((item) => item.userId));
  const demoEmails = new Set(DEMO_ACTORS.map((item) => item.email));
  return store.findMany('users', (user) => demoIds.has(user.id) || demoEmails.has(normalizeEmail(user.email))).map((user) => {
    const membership = store.findMany('memberships', (item) => item.userId === user.id)[0];
    const organization = membership ? store.findOne('organizations', (item) => item.id === membership.organizationId) : null;
    return {
      id: user.id,
      displayName: user.displayName,
      email: user.email || DEMO_ACTORS.find((item) => item.userId === user.id)?.email || null,
      organizationId: organization?.id || membership?.organizationId || null,
      organizationName: organization?.name || null,
      kind: organizationKind(organization)
    };
  });
}

function sessionCookie(token, { clear = false } = {}) {
  if (clear) return 'carbonbridge_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
  return `carbonbridge_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_SECONDS}`;
}

module.exports = {
  DEMO_PASSWORD,
  SESSION_TTL_SECONDS,
  hashPassword,
  verifyPassword,
  organizationKind,
  seedDemoAccounts,
  register,
  login,
  logout,
  sessionFromToken,
  listDemoActors,
  sessionCookie,
  publicUser,
  publicOrganization
};
