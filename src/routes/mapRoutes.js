// src/routes/mapRoutes.js
const express = require('express');
const router = express.Router();
const mapController = require('../controllers/mapController');
const { auth } = require('../middleware/authMiddleware');
const { body, param } = require('express-validator');


// ROADMAP-FIX (Backend Hardening): Add validation for all inputs
const createMapValidation = [
    body('mapName').notEmpty().trim().escape().withMessage('Map name is required'),
    body('friendId').isInt().withMessage('Invalid friend ID'),
];

const renameMapValidation = [
    param('mapId').isInt(),
    body('newName').notEmpty().trim().escape().withMessage('New name is required'),
];

const updateMarkersValidation = [
    param('mapId').isInt(),
    body('selectedMarkerIds').isArray(),
    body('selectedMarkerIds.*').isInt(),
];

// GET routes are now secured
router.get('/user/:userId', auth, mapController.getMapsForUser);
router.get('/:mapId/members', auth, mapController.getMapMembers);
router.get('/invitations/me', auth, mapController.getPendingMapInvitations);
router.get('/:mapId/user-markers/:userId', auth, mapController.getLinkedMarkerIdsForUserOnMap);

// POST, PUT, DELETE routes are secured
router.post('/create', auth, createMapValidation, mapController.createMapAndInviteFriend);
router.post('/invitations/accept', auth, [ body('mapUserId').isInt() ], mapController.acceptMapInvitation);
router.post('/invitations/decline', auth, [ body('mapUserId').isInt() ], mapController.declineMapInvitation);
router.put('/:mapId/rename', auth, renameMapValidation, mapController.renameMap);
router.put('/:mapId/user-markers', auth, updateMarkersValidation, mapController.updateMarkersForMap);
router.delete('/:mapId', auth, [ param('mapId').isInt() ], mapController.deleteMap);

module.exports = router;
