// src/controllers/friendController.js
const db = require('../db');
const { log } = require('../utils/logger');

exports.getFriends = async (req, res) => {
    const requestedUserId = parseInt(req.params.userId, 10);
    const authenticatedUserId = req.user.id;

    if (authenticatedUserId !== requestedUserId) {
        return res.status(403).json({ message: "Forbidden: You can only view your own friend list." });
    }

    try {
        const results = await db.query(
            "SELECT user_one_id, user_two_id FROM friendships WHERE (user_one_id = $1 OR user_two_id = $1) AND status = 'accepted'",
            [requestedUserId]
        );
        if (results.rows.length === 0) return res.status(200).json([]);

        const friendIds = results.rows.map(row =>
            row.user_one_id == requestedUserId ? row.user_two_id : row.user_one_id
        );

        const friendData = await db.query(
            "SELECT id, username, email FROM travelit_users WHERE id = ANY($1::int[])",
            [friendIds]
        );
        res.status(200).json(friendData.rows);
    } catch (error) {
        log("Error getting friends:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.getPendingRequests = async (req, res) => {
    const currentUserId = req.user.id;
    try {
        const results = await db.query(
            "SELECT action_user_id FROM friendships WHERE (user_one_id = $1 OR user_two_id = $1) AND status = 'pending' AND action_user_id != $1",
            [currentUserId]
        );
        if (results.rows.length === 0) return res.status(200).json([]);

        const requestorIds = results.rows.map(row => row.action_user_id);
        const requestorData = await db.query(
            "SELECT id, username, email FROM travelit_users WHERE id = ANY($1::int[])",
            [requestorIds]
        );
        res.status(200).json(requestorData.rows);
    } catch (error) {
        log("Error getting pending requests:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.sendFriendRequest = async (req, res) => {
    const currentUserId = req.user.id;
    const { friendId } = req.body;
    log(`sendFriendRequest von #${currentUserId} an #${friendId}`);

    if (currentUserId == friendId) return res.status(400).json({ message: "Cannot send request to yourself." });

    const userOne = Math.min(currentUserId, friendId);
    const userTwo = Math.max(currentUserId, friendId);

    try {
        const existing = await db.query(
            "SELECT id FROM friendships WHERE user_one_id = $1 AND user_two_id = $2",
            [userOne, userTwo]
        );
        if (existing.rows.length > 0) return res.status(409).json({ message: "Friendship already exists or is pending." });

        await db.query(
            "INSERT INTO friendships (user_one_id, user_two_id, status, action_user_id) VALUES ($1, $2, 'pending', $3)",
            [userOne, userTwo, currentUserId]
        );
        res.status(201).json({ success: true, message: "Friend request sent." });
    } catch (error) {
        log("Error sending friend request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.acceptFriendRequest = async (req, res) => {
    const currentUserId = req.user.id;
    const { friendId } = req.body;
    log(`acceptFriendRequest von #${currentUserId} für #${friendId}`);

    const userOne = Math.min(currentUserId, friendId);
    const userTwo = Math.max(currentUserId, friendId);
    try {
        await db.query(
            "UPDATE friendships SET status = 'accepted', action_user_id = $1 WHERE user_one_id = $2 AND user_two_id = $3 AND status = 'pending'",
            [currentUserId, userOne, userTwo]
        );
        res.status(200).json({ success: true, message: "Friend request accepted." });
    } catch (error) {
        log("Error accepting friend request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.declineOrRemoveFriend = async (req, res) => {
    const currentUserId = req.user.id;
    const { friendId } = req.body;
    log(`declineOrRemoveFriend von #${currentUserId} mit #${friendId}`);

    const userOne = Math.min(currentUserId, friendId);
    const userTwo = Math.max(currentUserId, friendId);
    try {
        const result = await db.query(
            "DELETE FROM friendships WHERE user_one_id = $1 AND user_two_id = $2",
            [userOne, userTwo]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ message: "Friendship not found." });
        }
        res.status(200).json({ success: true, message: "Friend removed or request declined." });
    } catch (error) {
        log("Error removing friend:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};