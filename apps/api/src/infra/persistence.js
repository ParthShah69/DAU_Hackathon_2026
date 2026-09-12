const { Store, COLLECTIONS } = require('./store');

/**
 * Small persistence boundary shared by the demo and the production adapter.
 * Domain services only need the table/query methods exposed by the contained
 * store plus a transaction callback. The demo callback is synchronous because
 * all mutations are in-process; the PostgreSQL adapter is intentionally a
 * contract stub until the database dependency is introduced.
 */
class PersistenceAdapter {
  transaction(callback) {
    return callback(this);
  }

  live() {
    return true;
  }

  ready() {
    return true;
  }
}

class MemoryPersistence extends PersistenceAdapter {
  constructor({ clock, seed } = {}) {
    super();
    this.store = new Store(clock);
    if (seed) this.store.reset(seed);
  }

  reset(seed) {
    return this.store.reset(seed);
  }

  now() {
    return this.store.now();
  }

  findOne(collection, predicate) {
    return this.store.findOne(collection, predicate);
  }

  findMany(collection, predicate) {
    return this.store.findMany(collection, predicate);
  }

  insert(collection, record) {
    return this.store.insert(collection, record);
  }

  replace(collection, id, patch) {
    return this.store.replace(collection, id, patch);
  }

  snapshot() {
    return this.store.snapshot();
  }
}

for (const collection of COLLECTIONS) {
  Object.defineProperty(MemoryPersistence.prototype, collection, {
    get() {
      return this.store[collection];
    }
  });
}

class PostgresPersistence extends PersistenceAdapter {
  constructor({ pool } = {}) {
    super();
    this.pool = pool || null;
  }

  live() {
    return Boolean(this.pool);
  }

  ready() {
    return Boolean(this.pool);
  }

  async transaction(callback) {
    if (!this.pool) throw new Error('Postgres persistence is not configured');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

module.exports = { PersistenceAdapter, MemoryPersistence, PostgresPersistence };
