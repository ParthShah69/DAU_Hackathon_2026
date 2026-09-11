const demoSeed = require('../../data/demo/marketplace.json');

const COLLECTIONS = [
  'organizations',
  'users',
  'memberships',
  'sites',
  'streams',
  'qualityReports',
  'analyteResults',
  'supplyPeriods',
  'requirements',
  'rateCards',
  'distanceEstimates',
  'processes',
  'discoveryCandidates',
  'listingDrafts',
  'conversations',
  'messages',
  'workflows',
  'workflowSteps',
  'actions',
  'matchRuns',
  'matchResults',
  'supplyRequests',
  'requestEvents',
  'reservations',
  'auditEvents',
  'idempotencyRecords'
];

function clone(value) {
  return structuredClone(value);
}

class Store {
  constructor(clock = () => new Date()) {
    this.clock = clock;
    this.reset();
  }

  reset(seed = demoSeed) {
    for (const collection of COLLECTIONS) {
      this[collection] = [];
    }
    for (const collection of Object.keys(seed)) {
      if (Array.isArray(seed[collection]) && COLLECTIONS.includes(collection)) {
        this[collection].push(...clone(seed[collection]));
      }
    }
    this.seedSource = clone(seed.source || { kind: 'unknown' });
    return this.snapshot();
  }

  now() {
    return this.clock().toISOString();
  }

  findOne(collection, predicate) {
    return this[collection].find(predicate);
  }

  findMany(collection, predicate = () => true) {
    return this[collection].filter(predicate);
  }

  insert(collection, record) {
    if (!COLLECTIONS.includes(collection)) {
      throw new Error(`Unknown collection: ${collection}`);
    }
    const copy = clone(record);
    this[collection].push(copy);
    return clone(copy);
  }

  replace(collection, id, patch) {
    const list = this[collection];
    const index = list.findIndex((item) => item.id === id);
    if (index < 0) return null;
    list[index] = { ...list[index], ...clone(patch) };
    return clone(list[index]);
  }

  snapshot() {
    const result = { source: clone(this.seedSource) };
    for (const collection of COLLECTIONS) {
      result[collection] = clone(this[collection]);
    }
    return result;
  }
}

module.exports = { Store, COLLECTIONS, clone };
