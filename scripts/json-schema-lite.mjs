/*
 * A deliberately small JSON Schema 2020-12 validator for the repository's
 * dependency-free checks. It implements the keywords used by the committed
 * CarbonBridge contracts and fails closed on malformed schemas. The API lane
 * can replace this with a full validator when dependencies are available;
 * this check keeps CI honest on a clean machine today.
 */

function typeMatches(type, value) {
  if (type === 'null') return value === null;
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
  if (type === 'array') return Array.isArray(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'boolean') return typeof value === 'boolean';
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
  return true;
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer';
  return typeof value;
}

function resolveJsonPointer(rootSchema, pointer) {
  if (!pointer.startsWith('#/')) throw new Error(`Only local schema references are supported: ${pointer}`);
  return pointer.slice(2).split('/').map((segment) => segment.replaceAll('~1', '/').replaceAll('~0', '~')).reduce((value, key) => {
    if (value === undefined || value === null || !(key in value)) throw new Error(`Unresolvable schema reference: ${pointer}`);
    return value[key];
  }, rootSchema);
}

function add(errors, location, message) {
  errors.push(`${location}: ${message}`);
}

function validateNode(schema, value, location, rootSchema, errors) {
  if (!schema || typeof schema !== 'object') throw new Error(`${location}: schema node must be an object`);
  if (schema.$ref) {
    validateNode(resolveJsonPointer(rootSchema, schema.$ref), value, location, rootSchema, errors);
    return;
  }
  if (schema.allOf) {
    if (!Array.isArray(schema.allOf)) throw new Error(`${location}: allOf must be an array`);
    for (const member of schema.allOf) validateNode(member, value, location, rootSchema, errors);
  }
  if (schema.oneOf) {
    if (!Array.isArray(schema.oneOf)) throw new Error(`${location}: oneOf must be an array`);
    const matches = schema.oneOf.filter((member) => {
      const nested = [];
      validateNode(member, value, location, rootSchema, nested);
      return nested.length === 0;
    }).length;
    if (matches !== 1) add(errors, location, `oneOf matched ${matches} schemas`);
  }
  if (schema.anyOf) {
    if (!Array.isArray(schema.anyOf)) throw new Error(`${location}: anyOf must be an array`);
    const matches = schema.anyOf.some((member) => {
      const nested = [];
      validateNode(member, value, location, rootSchema, nested);
      return nested.length === 0;
    });
    if (!matches) add(errors, location, 'anyOf matched no schemas');
  }
  if (schema.const !== undefined && !Object.is(value, schema.const)) add(errors, location, `must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && (!Array.isArray(schema.enum) || !schema.enum.some((candidate) => Object.is(candidate, value)))) add(errors, location, 'must match an enum value');
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((type) => typeMatches(type, value))) {
      add(errors, location, `must be ${types.join(' or ')}, received ${valueType(value)}`);
      return;
    }
  }
  if (schema.required) {
    if (!Array.isArray(schema.required)) throw new Error(`${location}: required must be an array`);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) add(errors, location, 'required applies only to objects');
    else for (const key of schema.required) if (!Object.prototype.hasOwnProperty.call(value, key)) add(errors, `${location}.${key}`, 'is required');
  }
  if (schema.properties) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const [key, childSchema] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(value, key)) validateNode(childSchema, value[key], `${location}.${key}`, rootSchema, errors);
      }
    }
  }
  if (schema.additionalProperties === false && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const allowed = new Set(Object.keys(schema.properties ?? {}));
    for (const key of Object.keys(value)) if (!allowed.has(key)) add(errors, `${location}.${key}`, 'is not allowed by additionalProperties=false');
  }
  if (schema.items && Array.isArray(value)) {
    for (const [index, child] of value.entries()) validateNode(schema.items, child, `${location}[${index}]`, rootSchema, errors);
  }
  if (schema.minItems !== undefined && Array.isArray(value) && value.length < schema.minItems) add(errors, location, `must contain at least ${schema.minItems} items`);
  if (schema.maxItems !== undefined && Array.isArray(value) && value.length > schema.maxItems) add(errors, location, `must contain at most ${schema.maxItems} items`);
  if (schema.minimum !== undefined && typeof value === 'number' && value < schema.minimum) add(errors, location, `must be >= ${schema.minimum}`);
  if (schema.maximum !== undefined && typeof value === 'number' && value > schema.maximum) add(errors, location, `must be <= ${schema.maximum}`);
  if (schema.minLength !== undefined && typeof value === 'string' && value.length < schema.minLength) add(errors, location, `must contain at least ${schema.minLength} characters`);
  if (schema.maxLength !== undefined && typeof value === 'string' && value.length > schema.maxLength) add(errors, location, `must contain at most ${schema.maxLength} characters`);
  if (schema.pattern !== undefined && typeof value === 'string' && !(new RegExp(schema.pattern).test(value))) add(errors, location, `does not match ${schema.pattern}`);
  if (schema.format === 'uuid' && typeof value === 'string' && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) add(errors, location, 'must be a UUID');
  if (schema.format === 'date-time' && typeof value === 'string' && (Number.isNaN(Date.parse(value)) || !value.includes('T'))) add(errors, location, 'must be an ISO date-time');
}

function validateSchemaInstance(schema, value, rootSchema = schema) {
  const errors = [];
  validateNode(schema, value, '$', rootSchema, errors);
  return errors;
}

export { validateSchemaInstance };
