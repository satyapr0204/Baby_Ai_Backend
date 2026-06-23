const axios = require("axios");
require("dotenv").config();

async function predictSize(data) {
    if (!process.env.AI_SERVICE_URL) {
        throw new Error("AI_SERVICE_URL environment variable is not configured");
    }

    try {
        const response = await axios.post(
            process.env.AI_SERVICE_URL,
            data
        );
        return response.data;
    } catch (error) {
        const message = error.response
            ? `AI service returned ${error.response.status}: ${error.response.data?.message || error.response.statusText}`
            : `AI service request failed: ${error.message}`;
        throw new Error(message);
    }
}

module.exports = { predictSize };