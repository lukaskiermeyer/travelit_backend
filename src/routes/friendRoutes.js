// src/routes/friendRoutes.js
const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const { auth } = require('../middleware/authMiddleware');

// GET routes are now secured
router.get('/:userId', auth, friendController.getFriends);
router.get('/pending/me', auth, friendController.getPendingRequests); // Changed route for clarity

// POST/PUT/DELETE routes are secured
router.post('/request', auth, friendController.sendFriendRequest);
router.put('/accept', auth, friendController.acceptFriendRequest);
router.post('/remove', auth, friendController.declineOrRemoveFriend); // Using POST for body compatibility

module.exports = router;