class DomainError extends Error {
  constructor(code, message, statusCode = 400, details = undefined) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

function requireValue(value, field) {
  if (value === undefined || value === null || value === '') {
    throw new DomainError('VALIDATION_ERROR', `${field} is required`);
  }
  return value;
}

function requireOne(record, field, collection) {
  const value = record?.[field];
  if (!value) {
    throw new DomainError('NOT_FOUND', `${collection} ${field} was not found`, 404);
  }
  return value;
}

module.exports = { DomainError, requireValue, requireOne };
