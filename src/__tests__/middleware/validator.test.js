const validateBody = require('../../middleware/validator');

describe('validateBody middleware', () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
  });

  it('should call next() when all required fields are present', () => {
    const middleware = validateBody(['name', 'email']);
    const req = { body: { name: 'John', email: 'john@example.com' } };
    const res = {};

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('should pass error to next when body is empty', () => {
    const middleware = validateBody(['name']);
    const req = { body: {} };
    const res = {};

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err).toBeDefined();
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('missing or empty');
  });

  it('should pass error to next when body is null', () => {
    const middleware = validateBody(['name']);
    const req = { body: null };
    const res = {};

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
  });

  it('should pass error when required field is undefined', () => {
    const middleware = validateBody(['name', 'email']);
    const req = { body: { name: 'John' } };
    const res = {};

    middleware(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('email');
  });

  it('should pass error when required field is null', () => {
    const middleware = validateBody(['name']);
    const req = { body: { name: null } };
    const res = {};

    middleware(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('name');
  });

  it('should pass error when required field is empty string', () => {
    const middleware = validateBody(['name']);
    const req = { body: { name: '   ' } };
    const res = {};

    middleware(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(err.message).toContain('name');
  });

  it('should accept numeric zero as a valid value', () => {
    const middleware = validateBody(['count']);
    const req = { body: { count: 0 } };
    const res = {};

    middleware(req, res, next);

    // "0".trim() === "0" which is not empty, so should pass
    expect(next).toHaveBeenCalledWith();
  });

  it('should accept boolean false as a valid value', () => {
    const middleware = validateBody(['active']);
    const req = { body: { active: false } };
    const res = {};

    middleware(req, res, next);

    // String(false).trim() === "false" which is not empty
    expect(next).toHaveBeenCalledWith();
  });

  it('should work with empty required fields array', () => {
    const middleware = validateBody([]);
    const req = { body: { anything: 'value' } };
    const res = {};

    middleware(req, res, next);

    expect(next).toHaveBeenCalledWith();
  });
});
