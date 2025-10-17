// src/utils/mailer.js
const sgMail = require('@sendgrid/mail');
const { log } = require('./logger');
require('dotenv').config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function sendVerificationEmail(to, token) {
    const verificationLink = `http://localhost:3000/api/auth/verify?token=${token}`;

    const msg = {
        to: to,
        from: process.env.VERIFIED_SENDER_EMAIL,
        subject: 'Verify your TravelIt Account',
        html: `
            <h1>Welcome to TravelIt!</h1>
            <p>Please click the link below to verify your email address:</p>
            <a href="${verificationLink}">Verify my Account</a>
            <p>This link will expire in 1 hour.</p>
        `,
    };

    try {
        await sgMail.send(msg);
        log(`Verification email sent successfully to ${to}`);
    } catch (error) {
        log('Error sending verification email:', error);
        if (error.response) {
            log(error.response.body);
        }
    }
}

module.exports = { sendVerificationEmail };