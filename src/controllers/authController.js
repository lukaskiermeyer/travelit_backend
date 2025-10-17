// src/controllers/authController.js
const db = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { log } = require('../utils/logger');
const { validationResult } = require('express-validator');
const { sendVerificationEmail } = require('../utils/mailer');

exports.register = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, username, password } = req.body;

    try {
        const existingUserResult = await db.query(
            "SELECT id, is_verified FROM travelit_users WHERE email = $1 OR username = $2",
            [email, username]
        );

        if (existingUserResult.rows.length > 0) {
            const existingUser = existingUserResult.rows[0];

            if (existingUser.is_verified) {
                log(`Registrierungsversuch für bereits verifizierten Account: ${email}`);
                return res.status(409).json({ message: "User with this email or username already exists." });
            } else {
                log(`Entferne alten, unverifizierten Account: ${email}`);
                await db.query("DELETE FROM travelit_users WHERE id = $1", [existingUser.id]);
            }
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationTokenExpires = new Date(Date.now() + 3600000); // 1 Stunde

        await db.query(
            "INSERT INTO travelit_users (email, username, password, verification_token, verification_token_expires) VALUES ($1, $2, $3, $4, $5)",
            [email, username, hashedPassword, verificationToken, verificationTokenExpires]
        );

        await sendVerificationEmail(email, verificationToken);

        res.status(201).json({ success: true, message: "Registration successful. Please check your email to verify your account." });
    } catch (error) {
        log("Register Error:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.verifyEmail = async (req, res) => {
    const { token } = req.query;
    log(`Email verification attempt with token: ${token}`);

    try {
        const result = await db.query(
            "SELECT id, verification_token_expires FROM travelit_users WHERE verification_token = $1",
            [token]
        );

        if (result.rows.length === 0) {
            return res.status(400).send('Invalid verification token.');
        }

        const user = result.rows[0];
        if (new Date() > new Date(user.verification_token_expires)) {
            return res.status(400).send('Verification token has expired.');
        }

        await db.query(
            "UPDATE travelit_users SET is_verified = TRUE, verification_token = NULL, verification_token_expires = NULL WHERE id = $1",
            [user.id]
        );

        const redirectUrl = `${process.env.FRONTEND_URL}/#/verified`;
        log(`Verification successful. Redirecting to: ${redirectUrl}`);
        return res.redirect(redirectUrl);

    } catch (error) {
        log('Email verification error:', error);
        res.status(500).send('Internal server error');
    }
};

exports.login = async (req, res) => {
    log('Login-Anfrage gestartet...');
    const { usernameOrEmail, password } = req.body;

    if (!usernameOrEmail || !password) {
        return res.status(400).json({ message: "Username/Email and password are required." });
    }

    try {
        const result = await db.query(
            "SELECT id, username, email, password, is_verified FROM travelit_users WHERE (username = $1 OR email = $1)",
            [usernameOrEmail]
        );

        if (result.rows.length === 0) {
            log('Ergebnis: Benutzer nicht gefunden.');
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const user = result.rows[0];

        if (!user.is_verified) {
            log(`Login attempt from unverified user: ${user.email}`);
            return res.status(403).json({ message: 'Please verify your email address to log in.' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            log('Ergebnis: Passwort stimmt NICHT überein.');
            return res.status(401).json({ message: "Invalid credentials." });
        }

        const payload = { user: { id: user.id } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({ token });

    } catch (error) {
        log('FATALER FEHLER im Login-Prozess:', error);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await db.query(
            // PHASE 2: Added avatar_url to the query
            "SELECT id, username, email, avatar_url FROM travelit_users WHERE id = $1",
            [req.user.id]
        );

        if (user.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json(user.rows[0]);
    } catch (err) {
        log('Error in getMe:', err.message);
        res.status(500).send('Server Error');
    }
};