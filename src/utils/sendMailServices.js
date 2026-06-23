require('dotenv').config();
const nodemailer = require('nodemailer');

const sendOtpOnEmail = async (mailOptions, retries = 3) => {
    const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_PASS,
        },
        tls: {
            rejectUnauthorized: false,
        },
    });

    let lastError;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await transporter.sendMail(mailOptions);
            console.log('OTP email sent successfully!');
            return;
        } catch (err) {
            lastError = err;
            console.error(`Error sending email (attempt ${attempt}/${retries}):`, err.message);
            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
    }
    throw new Error(`Failed to send OTP email after ${retries} attempts: ${lastError.message}`);
};

module.exports = { sendOtpOnEmail }