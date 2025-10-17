// src/controllers/mapController.js
const db = require('../db');
const { log } = require('../utils/logger');

exports.getMapsForUser = async (req, res) => {
    const requestedUserId = parseInt(req.params.userId, 10);
    const authenticatedUserId = req.user.id;

    if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only view your own map list." });
    }

    try {
        const results = await db.query(
            `SELECT tm.id, tm.title FROM travelit_maps tm JOIN travelit_mapusers mu ON tm.id = mu.map_id WHERE mu.user_id = $1 AND mu.status = 'accepted'`,
            [requestedUserId]
        );
        res.status(200).json(results.rows);
    } catch (error) {
        log("Error getting maps for user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getMapMembers = async (req, res) => {
    const { mapId } = req.params;
    const authenticatedUserId = req.user.id;

    try {
        const membershipCheck = await db.query(
            'SELECT id FROM travelit_mapusers WHERE map_id = $1 AND user_id = $2 AND status = \'accepted\'',
            [mapId, authenticatedUserId]
        );
        if (membershipCheck.rows.length === 0) {
            return res.status(403).json({ message: "Forbidden: You are not a member of this map." });
        }

        const results = await db.query(
            `SELECT u.id, u.username, u.email, u.avatar_url, mu.role FROM travelit_mapusers mu JOIN travelit_users u ON mu.user_id = u.id WHERE mu.map_id = $1 AND mu.status = 'accepted'`,
            [mapId]
        );
        const members = results.rows.map(row => ({
            user: { id: row.id, username: row.username, email: row.email, avatar_url: row.avatar_url },
            role: row.role,
        }));
        res.status(200).json(members);
    } catch (error) {
        log("Error getting map members:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPendingMapInvitations = async (req, res) => {
    const userId = req.user.id;
    try {
        const results = await db.query(
            `SELECT mu.id as map_user_id, m.id as map_id, m.title, u.username as invited_by_username FROM travelit_mapusers mu JOIN travelit_maps m ON mu.map_id = m.id JOIN travelit_users u ON mu.invited_by = u.id WHERE mu.user_id = $1 AND mu.status = 'pending'`,
            [userId]
        );
        res.status(200).json(results.rows);
    } catch (error) {
        log("Error getting map invitations:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.createMapAndInviteFriend = async (req, res) => {
    const ownerId = req.user.id;
    const { mapName, friendId } = req.body;
    log(`createMapAndInviteFriend von #${ownerId} für #${friendId} mit Name "${mapName}"`);
    try {
        const mapResult = await db.query(
            "INSERT INTO travelit_maps (title, created_by) VALUES ($1, $2) RETURNING id",
            [mapName, ownerId]
        );
        const mapId = mapResult.rows[0].id;
        await db.query(
            "INSERT INTO travelit_mapusers (map_id, user_id, invited_by, role, status) VALUES ($1, $2, $3, 'owner', 'accepted')",
            [mapId, ownerId, ownerId]
        );
        await db.query(
            "INSERT INTO travelit_mapusers (map_id, user_id, invited_by) VALUES ($1, $2, $3)",
            [mapId, friendId, ownerId]
        );
        res.status(201).json({ id: mapId });
    } catch (error) {
        log("Error creating map:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.acceptMapInvitation = async (req, res) => {
    const userId = req.user.id;
    const { mapUserId } = req.body;
    try {
        const inviteCheck = await db.query('SELECT user_id FROM travelit_mapusers WHERE id = $1 AND status = \'pending\'', [mapUserId]);
        if (inviteCheck.rows.length === 0 || inviteCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ message: "Forbidden: Invitation not found or not for you." });
        }
        await db.query("UPDATE travelit_mapusers SET status = 'accepted' WHERE id = $1", [mapUserId]);
        res.status(200).json({ success: true, message: "Invitation accepted." });
    } catch (error) {
        log("Error accepting map invitation:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.declineMapInvitation = async (req, res) => {
    const userId = req.user.id;
    const { mapUserId } = req.body;
    try {
        const inviteCheck = await db.query('SELECT user_id FROM travelit_mapusers WHERE id = $1', [mapUserId]);
        if (inviteCheck.rows.length === 0 || inviteCheck.rows[0].user_id !== userId) {
            return res.status(403).json({ message: "Forbidden: Invitation not found or not for you." });
        }
        await db.query("DELETE FROM travelit_mapusers WHERE id = $1", [mapUserId]);
        res.status(200).json({ success: true, message: "Invitation declined." });
    } catch (error) {
        log("Error declining map invitation:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteMap = async (req, res) => {
    const userId = req.user.id;
    const { mapId } = req.params;
    try {
        const mapCheck = await db.query('SELECT created_by FROM travelit_maps WHERE id = $1', [mapId]);
        if (mapCheck.rows.length === 0 || mapCheck.rows[0].created_by !== userId) {
            return res.status(403).json({ message: "Forbidden: You are not the owner of this map." });
        }
        await db.query("DELETE FROM travelit_mapusers WHERE map_id = $1", [mapId]);
        await db.query("DELETE FROM travelit_mapmarkers WHERE map_id = $1", [mapId]);
        await db.query("DELETE FROM travelit_maps WHERE id = $1", [mapId]);
        res.status(200).json({ success: true, message: "Map deleted successfully." });
    } catch (error) {
        log("Error deleting map:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.renameMap = async (req, res) => {
    const userId = req.user.id;
    const { mapId } = req.params;
    const { newName } = req.body;
    try {
        const mapCheck = await db.query('SELECT created_by FROM travelit_maps WHERE id = $1', [mapId]);
        if (mapCheck.rows.length === 0 || mapCheck.rows[0].created_by !== userId) {
            return res.status(403).json({ message: "Forbidden: You are not the owner of this map." });
        }
        await db.query("UPDATE travelit_maps SET title = $1 WHERE id = $2", [newName, mapId]);
        res.status(200).json({ success: true, message: "Map renamed successfully." });
    } catch (error) {
        log("Error renaming map:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.updateMarkersForMap = async (req, res) => {
    const userId = req.user.id;
    const { mapId } = req.params;
    const { selectedMarkerIds } = req.body;
    log(`updateMarkersForMap für Karte #${mapId} von #${userId}`);
    try {
        const userMarkerResults = await db.query('SELECT id FROM markers WHERE userId = $1', [userId]);
        const allUserMarkerIds = userMarkerResults.rows.map(row => row.id);

        if (allUserMarkerIds.length > 0) {
            await db.query('DELETE FROM travelit_mapmarkers WHERE map_id = $1 AND marker_id = ANY($2::int[])', [mapId, allUserMarkerIds]);
        }

        if (selectedMarkerIds && selectedMarkerIds.length > 0) {
            for (const markerId of selectedMarkerIds) {
                if (allUserMarkerIds.includes(markerId)) {
                    await db.query('INSERT INTO travelit_mapmarkers (map_id, marker_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [mapId, markerId]);
                }
            }
        }
        res.status(200).json({ success: true, message: "Markers for map updated." });
    } catch (error) {
        log("Error updating markers for map:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getLinkedMarkerIdsForUserOnMap = async (req, res) => {
    const { mapId, userId } = req.params;
    const authenticatedUserId = req.user.id;

    if (authenticatedUserId !== parseInt(userId, 10)) {
        return res.status(403).json({ message: "Forbidden: You can only check your own linked markers." });
    }

    try {
        const results = await db.query(
            `SELECT u.id, u.username, u.email, u.avatar_url, mu.role FROM travelit_mapusers mu JOIN travelit_users u ON mu.user_id = u.id WHERE mu.map_id = $1 AND mu.status = 'accepted'`,
            [mapId]
        );
        res.status(200).json(results.rows.map(row => row.marker_id));
    } catch (e) {
        log('Error getting linked marker ids:', e);
        res.status(500).json({ message: "Internal server error" });
    }
};