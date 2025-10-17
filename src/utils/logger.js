// src/utils/logger.js

/**
 * Schreibt nur dann eine Nachricht in die Konsole, wenn DEBUG_LOGGING in der .env-Datei auf "1" gesetzt ist.
 * @param {...any} args - Die Nachrichten oder Objekte, die geloggt werden sollen.
 */
function log(...args) {
    if (process.env.DEBUG_LOGGING === '1') {
        // Fügt einen Zeitstempel und ein [DEBUG] Präfix hinzu, um die Logs leichter zu erkennen
        const timestamp = new Date().toISOString();
        console.log(`[DEBUG - ${timestamp}]`, ...args);
    }
}

// HIER IST DER WICHTIGSTE TEIL:
// Wir exportieren ein Objekt, das die 'log'-Funktion enthält.
module.exports = { log };