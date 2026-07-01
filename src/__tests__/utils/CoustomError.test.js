const CoustomError = require('../../utils/CoustomError');

describe('CoustomError', () => {
  it('should create an error with message and statusCode', () => {
    const err = new CoustomError('Not Found', 404);
    expect(err.message).toBe('Not Found');
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
  });

  it('should be an instance of Error', () => {
    const err = new CoustomError('Server Error', 500);
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(CoustomError);
  });

  it('should handle different status codes', () => {
    const cases = [
      { message: 'Bad Request', code: 400 },
      { message: 'Unauthorized', code: 401 },
      { message: 'Forbidden', code: 403 },
      { message: 'Internal Server Error', code: 500 },
    ];

    cases.forEach(({ message, code }) => {
      const err = new CoustomError(message, code);
      expect(err.message).toBe(message);
      expect(err.statusCode).toBe(code);
      expect(err.isOperational).toBe(true);
    });
  });

  it('should have a stack trace', () => {
    const err = new CoustomError('test', 400);
    expect(err.stack).toBeDefined();
  });

  it('should work with no arguments', () => {
    const err = new CoustomError();
    expect(err.message).toBe('');
    expect(err.statusCode).toBeUndefined();
    expect(err.isOperational).toBe(true);
  });
});
