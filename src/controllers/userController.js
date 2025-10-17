// src/controllers/userController.js
const db = require('../db');
const { log } = require('../utils/logger');
const cloudinary = require('../utils/cloudinary');
const { validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const streamifier = require('streamifier');

// --- (searchUserById, changePassword, deleteAccount functions remain unchanged) ---
/**
 * Searches for a user by their ID.
 * This is a protected route, so only authenticated users can perform a search.
 */
exports.searchUserById = async (req, res) => {
    log("searchUserById: ");
    const { userId } = req.params;
    console.log(userId);
    const authenticatedUserId = req.user.id;
    log(`Benutzer #${authenticatedUserId} sucht nach Benutzer #${userId}`);

    try {
        const results = await db.query(
            "SELECT id, username FROM travelit_users WHERE id = $1",
            [userId]
        );

        if (results.rows.length === 0) {
            return res.status(404).json({ message: "User not found." });
        }

        // Return only non-sensitive information
        res.status(200).json(results.rows);
    } catch (error) {
        log("Error searching for user:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

/**
 * Ändert das Passwort des authentifizierten Benutzers.
 */
exports.changePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;
    log(`Passwortänderung angefordert für Benutzer #${userId}`);

    try {
        // Hole den aktuellen Passwort-Hash des Benutzers aus der DB
        const userResult = await db.query('SELECT password FROM travelit_users WHERE id = $1', [userId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const storedHash = userResult.rows[0].password;

        // Prüfe, ob das alte Passwort korrekt ist
        const isMatch = await bcrypt.compare(oldPassword, storedHash);
        if (!isMatch) {
            log(`Passwortänderung fehlgeschlagen: Altes Passwort falsch für Benutzer #${userId}`);
            return res.status(400).json({ message: 'Incorrect old password' });
        }

        // Hashe das neue Passwort
        const salt = await bcrypt.genSalt(10);
        const newHashedPassword = await bcrypt.hash(newPassword, salt);

        // Speichere das neue Passwort in der DB
        await db.query('UPDATE travelit_users SET password = $1 WHERE id = $2', [newHashedPassword, userId]);

        log(`Passwort für Benutzer #${userId} erfolgreich geändert.`);
        res.status(200).json({ message: 'Password changed successfully' });

    } catch (error) {
        log('Fehler bei der Passwortänderung:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

/**
 * Löscht den Account des authentifizierten Benutzers und alle seine Daten.
 */
exports.deleteAccount = async (req, res) => {
    const userId = req.user.id;
    log(`Löschanfrage für Account #${userId}`);

    const client = await db.getClient(); // Transaktion starten
    try {
        await client.query('BEGIN');

        // 1. Alle Marker des Benutzers von geteilten Karten entfernen
        await client.query('DELETE FROM travelit_mapmarkers WHERE marker_id IN (SELECT id FROM markers WHERE userId = $1)', [userId]);
        // 2. Alle Marker des Benutzers löschen
        await client.query('DELETE FROM markers WHERE userId = $1', [userId]);
        // 3. Alle Mitgliedschaften des Benutzers auf Karten löschen
        await client.query('DELETE FROM travelit_mapusers WHERE user_id = $1', [userId]);
        // 4. Alle Freundschaften des Benutzers löschen
        await client.query('DELETE FROM friendships WHERE user_one_id = $1 OR user_two_id = $1', [userId]);

        // TODO: Was soll mit Karten passieren, die der Benutzer erstellt hat?
        // Option A: Karten und alle Mitgliedschaften darauf ebenfalls löschen (aktueller Code)
        await client.query('DELETE FROM travelit_mapusers WHERE map_id IN (SELECT id FROM travelit_maps WHERE created_by = $1)', [userId]);
        await client.query('DELETE FROM travelit_maps WHERE created_by = $1', [userId]);

        // 5. Den Benutzer selbst löschen
        await client.query('DELETE FROM travelit_users WHERE id = $1', [userId]);

        await client.query('COMMIT'); // Transaktion erfolgreich abschließen
        log(`Account #${userId} und alle zugehörigen Daten erfolgreich gelöscht.`);
        res.status(200).json({ message: 'Account deleted successfully' });

    } catch (error) {
        await client.query('ROLLBACK'); // Bei Fehler alles zurückrollen
        log('Fehler beim Löschen des Accounts:', error);
        res.status(500).json({ message: 'Internal server error' });
    } finally {
        client.release();
    }
};

// KORRIGIERT: Avatar-Upload mit Streaming
exports.uploadAvatar = async (req, res) => {
    const userId = req.user.id;
    log(`Avatar upload initiated for user #${userId}`);

    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    // Erstelle einen Promise, um auf das Ergebnis des Streams zu warten
    const uploadPromise = new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: "avatars",
                public_id: `user_${userId}`,
                overwrite: true,
                transformation: [{ width: 200, height: 200, gravity: "face", crop: "fill" }]
            },
            (error, result) => {
                if (error) {
                    return reject(error);
                }
                resolve(result);
            }
        );

        // Leite den Buffer aus dem Speicher in den Cloudinary Upload-Stream
        streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
    });

    try {
        const result = await uploadPromise;
        const avatarUrl = result.secure_url;

        await db.query('UPDATE travelit_users SET avatar_url = $1 WHERE id = $2', [avatarUrl, userId]);

        log(`Avatar for user #${userId} uploaded successfully: ${avatarUrl}`);
        res.status(200).json({ message: 'Avatar uploaded successfully', avatarUrl });

    } catch (error) {
        log('Error uploading avatar:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Diese Funktion muss existieren, wenn sie in `deleteAccount` aufgerufen wird.
// Sie sollte Teil Ihrer db.js-Datei sein, aber zur Sicherheit hier als Referenz.
db.getClient = db.getClient || (async () => {
    const { Pool } = require('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    return await pool.connect();
});

