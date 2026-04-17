const { KJUR, hextob64, KEYUTIL } = require('jsrsasign');
const axios = require('axios');

// --- Configuration ---
const CONFIG = {
    appKey: process.env.DOBA_APP_KEY || 'yourAppKey',
    privateKey: process.env.DOBA_PRIVATE_API_KEY || 'yourPrivateKey',
    // baseUrl: 'https://open.doba.com', 
    baseUrl: 'https://openapi.doba.com/',
    // baseUrl: 'https://openapi-sandbox.doba.com/',
    signType: 'rsa2',
    hash: 'SHA256withRSA'
};

/**
 * Global Function: Doba API Call
 * @param {string} endpoint - Jaise '/api/v2/products'
 * @param {object} params - Query parameters (optional)
 * @param {string} method - 'get' ya 'post' (default 'get')
 */
const callDobaApi = async (endpoint, params = {}, method = 'get') => {
    const timestamp = Date.now().toString();
    // const timestamp = 1610501018721
    // 1. Internal Signing Logic
    const pvKeyPem = `-----BEGIN PRIVATE KEY-----\n${CONFIG.privateKey}\n-----END PRIVATE KEY-----`;
    const dataToSign = `appKey=${CONFIG.appKey}&signType=${CONFIG.signType}&timestamp=${timestamp}`;
    console.log("dataToSign", dataToSign);
    console.log("privateKey", CONFIG.privateKey);
    const rsa = KEYUTIL.getKey(pvKeyPem);
    const sig = new KJUR.crypto.Signature({ alg: CONFIG.hash });
    sig.init(rsa);
    sig.updateString(dataToSign);
    const signature = hextob64(sig.sign());

    // 2. Making the Request
    try {
        const response = await axios({
            method: method,
            url: `${CONFIG.baseUrl.replace(/\/$/, '')}${endpoint}`,
            headers: {
                'appKey': CONFIG.appKey,
                'signType': CONFIG.signType,
                'timestamp': timestamp,
                'sign': signature,
                'Content-Type': 'application/json'
            },
            params: method === 'get' ? params : {},
            data: method === 'post' ? params : {}
        });
        return response.data; 
    } catch (error) {
        console.error(`Doba API Error (${endpoint}):`, error.response ? error.response.data : error.message);
        throw error;
    }
}


module.exports = { callDobaApi };