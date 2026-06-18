const fs = require('fs');
const path = require('path');
const { BabyTRYON } = require('../modals/babyTryOn');

/**
 * Base64 image string ko local folder me save karne ke liye utility function
 * @param {string} base64Data - Fashn AI se aayi hui base64 string
 * @param {string} prefix - File ke naam ka prefix (e.g., 'output', 'baby')
 * @returns {string|null} Saved file ka path ya null agar error aaye
 */

const saveOutputImage = async (base64Data, prefix = 'output', user_id, baby_id, product_id) => {
    try {
        console.log(" user_id, baby_id", user_id, ",", baby_id)
        const uploadDir = path.join(__dirname, '../../uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let buffer;
        let extension = 'png';
        if (matches && matches.length === 3) {
            extension = matches[1].split('/')[1] || 'png';
            buffer = Buffer.from(matches[2], 'base64');
        } else {
            buffer = Buffer.from(base64Data, 'base64');
        }
        const fileName = `${prefix}-${Date.now()}.${extension}`;
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, buffer);
        await BabyTRYON.create({
            try_on_avtar: fileName,
            try_on_user_id: user_id,
            try_on_baby_id: baby_id,
            try_on_product_id: product_id
        })
        console.log(`Success! Image saved locally at: ${filePath}`);
        return fileName;
    } catch (error) {
        console.error("Error saving image in utils:", error.message);
        return null;
    }
};

module.exports = {
    saveOutputImage
};