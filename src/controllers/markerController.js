// src/controllers/markerController.js
const db = require('../db');
const { log } = require('../utils/logger');

exports.getAllUserMarkers = async (req, res) => {
    const requestedUserId = parseInt(req.params.userId, 10);
    const authenticatedUserId = req.user.id;

    if (authenticatedUserId !== requestedUserId) {
        log(`Sicherheitsverletzung: Benutzer #${authenticatedUserId} versuchte, Marker von #${requestedUserId} zu sehen.`);
        return res.status(403).json({ message: "Forbidden: You can only view your own markers." });
    }

    try {
        const query = `
            SELECT m.id, m.latitude, m.longitude, m.userid, m.title, m.description, m.ranking, m.is_personal, m.category, m.trip_name, u.username, u.avatar_url 
            FROM markers m 
            JOIN travelit_users u ON m.userid = u.id 
            WHERE m.userid = $1
        `;
        const results = await db.query(query, [requestedUserId]);
        res.status(200).json(results.rows);
    } catch (error) {
        log("Error loading all user markers:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.getPersonalMarkers = async (req, res) => {
    const requestedUserId = parseInt(req.params.userId, 10);
    const authenticatedUserId = req.user.id;

    if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only view your own personal markers." });
    }

    try {
        const query = `
            SELECT m.id, m.latitude, m.longitude, m.userid, m.title, m.description, m.ranking, m.is_personal, m.category, m.trip_name, u.username, u.avatar_url 
            FROM markers m 
            JOIN travelit_users u ON m.userid = u.id 
            WHERE m.userid = $1 AND m.is_personal = true
        `;
        const results = await db.query(query, [requestedUserId]);
        res.status(200).json(results.rows);
    } catch (error) {
        log("Error loading personal markers:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.getMarkersForSharedMap = async (req, res) => {
    const { mapId } = req.params;
    const authenticatedUserId = req.user.id;

    try {
        const membershipCheck = await db.query(
            'SELECT id FROM travelit_mapusers WHERE map_id = $1 AND user_id = $2 AND status = \'accepted\'',
            [mapId, authenticatedUserId]
        );
        if (membershipCheck.rows.length === 0) {
            log(`Sicherheitsverletzung: Benutzer #${authenticatedUserId} versuchte, Marker von fremder Karte #${mapId} zu sehen.`);
            return res.status(403).json({ message: "Forbidden: You are not a member of this map." });
        }

        const query = `
            SELECT m.id, m.latitude, m.longitude, m.userid, m.title, m.description, m.ranking, m.is_personal, m.category, m.trip_name, u.username, u.avatar_url 
            FROM markers m
            JOIN travelit_mapmarkers mm ON m.id = mm.marker_id
            JOIN travelit_users u ON m.userId = u.id
            WHERE mm.map_id = $1
        `;
        const results = await db.query(query, [mapId]);
        log(results);
        res.status(200).json(results.rows);
    } catch (error) {
        log("Error loading shared map markers:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.getMapIdsForMarker = async (req, res) => {
    const { markerId } = req.params;
    const authenticatedUserId = req.user.id;

    try {
        const markerCheck = await db.query('SELECT userId FROM markers WHERE id = $1', [markerId]);
        if (markerCheck.rows.length === 0 || markerCheck.rows[0].userid !== authenticatedUserId) {
            return res.status(403).json({ message: "Forbidden: You cannot access this marker's details." });
        }

        const results = await db.query(
            'SELECT map_id FROM travelit_mapmarkers WHERE marker_id = $1',
            [markerId]
        );
        const mapIds = results.rows.map(row => row.map_id);
        res.status(200).json(mapIds);
    } catch (e) {
        log('Error getting map ids for marker:', e);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.saveMarker = async (req, res) => {
    const userId = req.user.id;
    const { latitude, longitude, title, description, ranking, category, trip_name, isPersonal, mapIdsToShare } = req.body;
    log(`saveMarker aufgerufen von Benutzer #${userId}`);

    try {
        const result = await db.query(
            'INSERT INTO markers (latitude, longitude, userId, title, description, ranking, category, trip_name, is_personal) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id',
            [latitude, longitude, userId, title, description, ranking, category, trip_name, isPersonal]
        );
        const newMarkerId = result.rows[0].id;

        if (mapIdsToShare && mapIdsToShare.length > 0) {
            for (const mapId of mapIdsToShare) {
                await db.query(
                    'INSERT INTO travelit_mapmarkers (map_id, marker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                    [mapId, newMarkerId]
                );
            }
        }
        res.status(201).json({ id: newMarkerId });
    } catch (error) {
        log("Error saving marker:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.updateMarker = async (req, res) => {
    const userId = req.user.id;
    const { markerId } = req.params;
    const { title, description, ranking, category, trip_name } = req.body;
    log(`updateMarker #${markerId} aufgerufen von Benutzer #${userId}`);

    try {
        const markerCheck = await db.query('SELECT userId FROM markers WHERE id = $1', [markerId]);
        if (markerCheck.rows.length === 0 || markerCheck.rows[0].userid !== userId) {
            return res.status(403).json({ message: "Forbidden: You do not own this marker." });
        }

        await db.query(
            'UPDATE markers SET title = $1, description = $2, ranking = $3, category = $4, trip_name = $5 WHERE id = $6',
            [title, description, ranking, category, trip_name, markerId]
        );
        res.status(200).json({ message: 'Marker updated successfully.' });
    } catch (error) {
        log("Error updating marker:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.deleteMarker = async (req, res) => {
    const userId = req.user.id;
    const { markerId } = req.params;
    log(`deleteMarker #${markerId} aufgerufen von Benutzer #${userId}`);

    try {
        const markerCheck = await db.query('SELECT userId FROM markers WHERE id = $1', [markerId]);
        if (markerCheck.rows.length === 0 || markerCheck.rows[0].userid !== userId) {
            return res.status(403).json({ message: "Forbidden: You do not own this marker." });
        }

        await db.query('DELETE FROM travelit_mapmarkers WHERE marker_id = $1', [markerId]);
        await db.query('DELETE FROM markers WHERE id = $1', [markerId]);
        res.status(200).json({ message: 'Marker deleted successfully.' });
    } catch (error) {
        log("Error deleting marker:", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

exports.updateMapLinksForMarker = async (req, res) => {
    const userId = req.user.id;
    const { markerId } = req.params;
    const { newMapIds } = req.body;
    log(`updateMapLinksForMarker #${markerId} aufgerufen von Benutzer #${userId}`);

    try {
        const markerCheck = await db.query('SELECT userId FROM markers WHERE id = $1', [markerId]);
        if (markerCheck.rows.length === 0 || markerCheck.rows[0].userid !== userId) {
            return res.status(403).json({ message: "Forbidden: You do not own this marker." });
        }

        await db.query('DELETE FROM travelit_mapmarkers WHERE marker_id = $1', [markerId]);

        if (newMapIds && newMapIds.length > 0) {
            for (const mapId of newMapIds) {
                const mapAccessCheck = await db.query(
                    'SELECT id FROM travelit_mapusers WHERE map_id = $1 AND user_id = $2 AND status = \'accepted\'',
                    [mapId, userId]
                );
                if (mapAccessCheck.rows.length > 0) {
                    await db.query(
                        'INSERT INTO travelit_mapmarkers (map_id, marker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                        [mapId, markerId]
                    );
                }
            }
        }
        res.status(200).json({ message: "Map links updated successfully." });
    } catch (e) {
        log('Error updating map links for marker:', e);
        res.status(500).json({ message: "Internal server error." });
    }
};