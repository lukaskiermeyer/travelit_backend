// src/routes/markerRoutes.js
const express = require('express');
const router = express.Router();
const markerController = require('../controllers/markerController');
const { auth } = require('../middleware/authMiddleware');
const { body, param } = require('express-validator');

// ROADMAP-FIX (Backend Hardening): Add validation for all inputs
const saveMarkerValidation = [
    body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('title').notEmpty().trim().escape().withMessage('Title is required'),
    body('description').optional().trim().escape(),
    body('ranking').isFloat({ min: 0, max: 10 }).withMessage('Ranking must be between 0 and 10'),
    body('category').notEmpty().trim().escape(),
    body('trip_name').notEmpty().trim().escape(),
    body('isPersonal').isBoolean(),
    body('mapIdsToShare').optional().isArray(),
    body('mapIdsToShare.*').optional().isInt(),
];

const updateMarkerValidation = [
    param('markerId').isInt().withMessage('Invalid Marker ID'),
    body('title').notEmpty().trim().escape().withMessage('Title is required'),
    body('description').optional().trim().escape(),
    body('ranking').isFloat({ min: 0, max: 10 }).withMessage('Ranking must be between 0 and 10'),
    body('category').notEmpty().trim().escape(),
    body('trip_name').notEmpty().trim().escape(),
];


// GET
router.get('/user/:userId/all', auth, markerController.getAllUserMarkers);
router.get('/user/:userId/personal', auth, markerController.getPersonalMarkers);
router.get('/map/:mapId', auth, markerController.getMarkersForSharedMap);
router.get('/:markerId/maps', auth, markerController.getMapIdsForMarker);

// POST
router.post('/', auth, saveMarkerValidation, markerController.saveMarker);

// PUT / PATCH
router.put('/:markerId', auth, updateMarkerValidation, markerController.updateMarker);
router.put('/:markerId/map-links', auth, [ param('markerId').isInt(), body('newMapIds').isArray() ], markerController.updateMapLinksForMarker);

// DELETE
router.delete('/:markerId', auth, [ param('markerId').isInt() ], markerController.deleteMarker);

module.exports = router;
