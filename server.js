// server.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');


// Load environment variables
dotenv.config();



const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow Cross-Origin requests
app.use(helmet()); // Adds security headers
app.use(express.json()); // Enable parsing of JSON in the request body

app.set('trust proxy', 1);
// General API rate limiter
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // Allow 200 requests per 15 minutes per IP
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests from this IP, please try again after 15 minutes',
});

app.use(limiter); // Apply the general rate limiter to all requests

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const friendRoutes = require('./src/routes/friendRoutes');
const mapRoutes = require('./src/routes/mapRoutes');
const markerRoutes = require('./src/routes/markerRoutes');
const userRoutes = require('./src/routes/userRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/maps', mapRoutes);
app.use('/api/markers', markerRoutes);
app.use('/api/users', userRoutes);

// Default route for a simple server check
app.get('/', (req, res) => {
    res.send('travelIt Backend is running!');
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
