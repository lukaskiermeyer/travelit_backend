// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const { log } = require('../utils/logger');

function auth(req, res, next) {
    // Hole den Token aus dem Header
    const token = req.header('Authorization');
    log('Auth-Middleware: Prüfe Header...', { token });

    // Prüfe, ob kein Token vorhanden ist
    if (!token) {
        log('Auth-Middleware: Zugriff verweigert. Kein Token gefunden.');
        return res.status(401).json({ message: 'No token, authorization denied' });
    }

    // Token ist üblicherweise im Format "Bearer <token>"
    const tokenValue = token.split(' ')[1];
    if (!tokenValue) {
        log('Auth-Middleware: Zugriff verweigert. Falsches Token-Format.');
        return res.status(401).json({ message: 'Token format is invalid' });
    }

    try {
        // Verifiziere den Token
        const decoded = jwt.verify(tokenValue, process.env.JWT_SECRET);

        // Füge den Benutzer aus dem Token-Payload zum Request-Objekt hinzu
        req.user = decoded.user;
        log('Auth-Middleware: Token ist gültig. Benutzer:', req.user);
        next(); // Gehe zur nächsten Funktion (dem eigentlichen Controller)
    } catch (err) {
        log('Auth-Middleware: Token ist nicht gültig.');
        res.status(401).json({ message: 'Token is not valid' });
    }
}

module.exports = { auth };