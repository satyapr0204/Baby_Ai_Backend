require('dotenv').config();
const jwt = require('jsonwebtoken');
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


    const sendEmail = async () => {
        try {
            await transporter.sendMail(mailOptions);
            console.log('OTP email sent successfully!');
        } catch (err) {
            console.error('Error sending email:', err);
            if (retries > 0) {
                console.log(`Retrying... (${retries} attempts left)`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                await sendEmail(retries = retries - 1);
            } else {
                throw new Error('Failed to send OTP email after multiple attempts');
            }
        }
    };

    await sendEmail(mailOptions, retries);
};



module.exports = { sendOtpOnEmail }