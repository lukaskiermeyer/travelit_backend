// hash_passwords.js
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();



async function updatePasswords() {
    console.log('Verbinde mit der Datenbank...');
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
    const client = await pool.connect();
    console.log('Verbindung erfolgreich.');

    try {
        console.log('Lese alle Benutzer aus der Datenbank...');
        const usersResult = await client.query('SELECT id, password FROM travelit_users');
        const users = usersResult.rows;

        if (users.length === 0) {
            console.log('Keine Benutzer in der Datenbank gefunden. Skript beendet.');
            return;
        }

        console.log(`${users.length} Benutzer gefunden. Beginne mit dem Hashing...`);

        for (const user of users) {
            // Prüfen, ob das Passwort bereits ein bcrypt-Hash ist, um doppeltes Hashen zu vermeiden
            if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
                console.log(`-> Benutzer #${user.id}: Passwort ist bereits gehasht. Überspringe.`);
                continue;
            }

            console.log(`-> Hashe Passwort für Benutzer #${user.id}...`);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(user.password, salt);

            // Speichere das gehashte Passwort in der Datenbank
            await client.query('UPDATE travelit_users SET password = $1 WHERE id = $2', [hashedPassword, user.id]);
            console.log(`   ...Erfolgreich aktualisiert für Benutzer #${user.id}.`);
        }

        console.log('\nAlle Passwörter wurden erfolgreich gehasht! ✅');

    } catch (error) {
        console.error('Ein Fehler ist aufgetreten:', error);
    } finally {
        await client.release();
        await pool.end();
        console.log('Datenbankverbindung geschlossen.');
    }
}

updatePasswords();