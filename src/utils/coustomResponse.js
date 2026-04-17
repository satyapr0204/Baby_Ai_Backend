// Custom success response
const sendResponse = (res, message = '', statusCode = 200, data = {}) => {
  return res.status(statusCode).json({
    status: statusCode,
    success: true,
    message,
    data,
  });
};

// Global error response
const sendError = (res, error) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Internal Server Error';
  return res.status(statusCode).json({
    status: statusCode,
    success: false,
    message,
    data: {},
  });
};

module.exports = { sendResponse, sendError };
