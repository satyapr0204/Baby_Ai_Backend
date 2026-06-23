const { sendResponse, sendError, sendListResponse } = require('../../utils/coustomResponse');

const createMockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('sendResponse', () => {
  it('should send a success response with defaults', () => {
    const res = createMockRes();
    sendResponse(res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: 200,
      success: true,
      message: '',
      data: {},
    });
  });

  it('should send a success response with custom values', () => {
    const res = createMockRes();
    sendResponse(res, 'Created', 201, { id: 1 });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      status: 201,
      success: true,
      message: 'Created',
      data: { id: 1 },
    });
  });
});

describe('sendError', () => {
  it('should send an error response with statusCode from error', () => {
    const res = createMockRes();
    const error = { statusCode: 404, message: 'Not Found' };
    sendError(res, error);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 404,
        success: false,
        message: 'Not Found',
      }),
    );
  });

  it('should default to 500 when statusCode is missing', () => {
    const res = createMockRes();
    const error = { message: 'Something broke' };
    sendError(res, error);
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('should default message to "Internal Server Error" when missing', () => {
    const res = createMockRes();
    const error = {};
    sendError(res, error);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Internal Server Error',
      }),
    );
  });

  it('should include stack in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const res = createMockRes();
    const error = new Error('Dev error');
    error.statusCode = 400;
    sendError(res, error);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.stack).toBeDefined();
    process.env.NODE_ENV = originalEnv;
  });

  it('should not include stack in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const res = createMockRes();
    const error = new Error('Prod error');
    error.statusCode = 500;
    sendError(res, error);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.stack).toBeUndefined();
    process.env.NODE_ENV = originalEnv;
  });
});

describe('sendListResponse', () => {
  it('should format array data with serial_no', () => {
    const res = createMockRes();
    const data = [{ name: 'Alice' }, { name: 'Bob' }];
    sendListResponse(res, 'Users fetched', data);
    expect(res.status).toHaveBeenCalledWith(200);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.data).toEqual([
      { name: 'Alice', serial_no: 1 },
      { name: 'Bob', serial_no: 2 },
    ]);
  });

  it('should handle Sequelize model instances with toJSON', () => {
    const res = createMockRes();
    const data = [
      { toJSON: () => ({ id: 1, name: 'Product A' }) },
      { toJSON: () => ({ id: 2, name: 'Product B' }) },
    ];
    sendListResponse(res, 'Products', data);
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.data).toEqual([
      { id: 1, name: 'Product A', serial_no: 1 },
      { id: 2, name: 'Product B', serial_no: 2 },
    ]);
  });

  it('should return empty array for non-array data', () => {
    const res = createMockRes();
    sendListResponse(res, 'No data', 'not-an-array');
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.data).toEqual([]);
  });

  it('should return empty array when data is undefined', () => {
    const res = createMockRes();
    sendListResponse(res, 'Empty');
    const jsonArg = res.json.mock.calls[0][0];
    expect(jsonArg.data).toEqual([]);
  });
});
