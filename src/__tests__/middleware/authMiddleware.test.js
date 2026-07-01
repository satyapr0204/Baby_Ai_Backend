const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../middleware/authMiddleware');

describe('authenticateToken middleware', () => {
  const JWT_SECRET = 'test-secret-key';
  let next;
  let res;

  beforeEach(() => {
    process.env.JWT_SECRET = JWT_SECRET;
    next = jest.fn();
    res = {};
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('should call next with error when no authorization header', () => {
    const req = { headers: {} };
    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.message).toContain('Access denied');
  });

  it('should call next with error when token is "null"', () => {
    const req = { headers: { authorization: 'Bearer null' } };
    authenticateToken(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.message).toContain('Access denied');
  });

  it('should call next with error when token is "undefined"', () => {
    const req = { headers: { authorization: 'Bearer undefined' } };
    authenticateToken(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
  });

  it('should call next with error when auth header lacks Bearer prefix', () => {
    const token = jwt.sign({ id: 1 }, JWT_SECRET);
    const req = { headers: { authorization: token } };
    authenticateToken(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.message).toContain('Access denied');
  });

  it('should set req.user and call next() for valid token', () => {
    const payload = { id: 42, email: 'test@test.com' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
    const req = { headers: { authorization: `Bearer ${token}` } };

    authenticateToken(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
    expect(req.user).toBeDefined();
    expect(req.user.id).toBe(42);
    expect(req.user.email).toBe('test@test.com');
  });

  it('should call next with error for invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid.token.here' } };
    authenticateToken(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Invalid token.');
  });

  it('should call next with error for expired token', (done) => {
    const token = jwt.sign({ id: 1 }, JWT_SECRET, { expiresIn: '1s' });
    const req = { headers: { authorization: `Bearer ${token}` } };

    setTimeout(() => {
      authenticateToken(req, res, next);
      const err = next.mock.calls[0][0];
      expect(err.statusCode).toBe(403);
      expect(err.message).toBe('Session expired.');
      done();
    }, 1500);
  });

  it('should call next with error for token signed with wrong secret', () => {
    const token = jwt.sign({ id: 1 }, 'wrong-secret');
    const req = { headers: { authorization: `Bearer ${token}` } };

    authenticateToken(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('Invalid token.');
  });
});
