const { DomainError } = require('./errors');

function decimal(value, field, options = {}) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new DomainError('INVALID_NUMBER', `${field} must be a finite number`);
  }
  if (options.min !== undefined && number < options.min) {
    throw new DomainError('INVALID_NUMBER', `${field} must be at least ${options.min}`);
  }
  if (options.max !== undefined && number > options.max) {
    throw new DomainError('INVALID_NUMBER', `${field} must be at most ${options.max}`);
  }
  return number;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function roundMoney(value) {
  return Math.round(value);
}

module.exports = { decimal, clamp, roundMoney };
