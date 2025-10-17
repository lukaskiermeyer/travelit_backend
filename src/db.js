// src/db.js
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

// Teste die Verbindung beim Start
pool.connect((err, client, release) => {
    if (err) {
        return console.error('Error acquiring client', err.stack);
    }
    console.log('Successfully connected to the database!');
    client.release();
});


module.exports = {
    query: (text, params) => pool.query(text, params),
};