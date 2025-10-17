// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const multer = require('multer'); // WICHTIG: Multer für Dateiuploads importieren
const userController = require('../controllers/userController');
const { auth } = require('../middleware/authMiddleware');
const { body } = require('express-validator');

// Konfiguriere Multer, um die Datei im Speicher zu halten (effizient für Cloud-Uploads)
const upload = multer({ storage: multer.memoryStorage() });

// Validierungsregeln für die Passwortänderung
const passwordValidationRules = [
    body('oldPassword', 'Old password is required').not().isEmpty(),
    body('newPassword', 'New password must be at least 8 characters long')
        .isLength({ min: 8 })
        .matches(/^(?=.*[a-zA-Z])(?=.*[0-9])/)
        .withMessage('Password must contain at least one letter and one number'),
];

// Route zum Suchen von Benutzern
router.get('/:userId', auth, userController.searchUserById);

// Route zum Ändern des eigenen Passworts
router.put('/me/password', auth, passwordValidationRules, userController.changePassword);

// Route zum Löschen des eigenen Accounts
router.delete('/me', auth, userController.deleteAccount);

// Route für den Avatar-Upload
// Die Middleware `upload.single('avatar')` fängt die Datei mit dem Feldnamen 'avatar' ab.
router.post('/me/avatar', auth, upload.single('avatar'), userController.uploadAvatar);

module.exports = router;

