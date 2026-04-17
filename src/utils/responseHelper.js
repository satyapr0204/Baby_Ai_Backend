// import { sendResponse } from "./CoustomResponse.js";
const { sendResponse } = require('./coustomResponse')


/**
 * Helper to send database data with serial_no added
 * @param {Object} res - Express response object
 * @param {String} message - Response message
 * @param {Array} data - Array of Sequelize model instances or plain objects
 * @param {Number} statusCode - HTTP status code (default 200)
 */
export function sendListResponse(res, message, data = [], statusCode = 200) {
  // Ensure we have an array
  const formattedData = Array.isArray(data)
    ? data.map((item, index) => ({
      ...(typeof item.toJSON === "function" ? item.toJSON() : item), // convert Sequelize instance
      serial_no: index + 1, // Add serial number
    }))
    : [];

  return sendResponse(res, message, statusCode, formattedData);
}
