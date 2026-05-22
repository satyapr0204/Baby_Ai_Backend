const axios = require("axios");
require("dotenv").config();

async function predictSize(data) {

    const response = await axios.post(
        process.env.AI_SERVICE_URL,
        data
    );

    return response.data;
}

module.exports = { predictSize };