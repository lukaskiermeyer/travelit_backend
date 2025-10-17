// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { auth } = require('../middleware/authMiddleware');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

// ROADMAP-FIX (Backend Hardening): Stricter rate limiting for auth routes
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login/register requests per window
    message: 'Too many authentication attempts from this IP, please try again after 15 minutes',
    standardHeaders: true,
    legacyHeaders: false,
});


const registerValidationRules = [
    body('email', 'Please include a valid email').isEmail().normalizeEmail(),
    body('username', 'Username must be at least 3 characters long').isLength({ min: 3 }).trim().escape(),
    body('password', 'Password must be at least 8 characters long')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
        .withMessage('Password must contain at least one letter and one number'),
];

router.post('/register', authLimiter, registerValidationRules, authController.register);
router.post('/login', authLimiter, authController.login);

router.get('/verify', authController.verifyEmail);

router.get('/me', auth, authController.getMe);

module.exports = router;
