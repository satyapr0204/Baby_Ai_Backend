// // Custom success response
// const sendResponse = (res, message = '', statusCode = 200, data = {}) => {
//   return res.status(statusCode).json({
//     status: statusCode,
//     success: true,
//     message,
//     data,
//   });
// };

// // Global error response
// const sendError = (res, error) => {
//   const statusCode = error.statusCode || 500;
//   const message = error.message || 'Internal Server Error';
//   return res.status(statusCode).json({
//     status: statusCode,
//     success: false,
//     message,
//     data: {},
//   });
// };

// module.exports = { sendResponse, sendError };

const sendResponse = (res, message = '', statusCode = 200, data = {}) => {
    return res.status(statusCode).json({
        status: statusCode,
        success: true,
        message,
        data,
    });
};

const sendError = (res, error) => {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal Server Error';
    
    return res.status(statusCode).json({
        status: statusCode,
        success: false,
        message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
};

const sendListResponse = (res, message, data = [], statusCode = 200) => {
    const formattedData = Array.isArray(data)
        ? data.map((item, index) => {
            // Sequelize model check
            const plainItem = item.toJSON ? item.toJSON() : item;
            return { ...plainItem, serial_no: index + 1 };
        })
        : [];

    return sendResponse(res, message, statusCode, formattedData);
};

module.exports = { sendResponse, sendError, sendListResponse };