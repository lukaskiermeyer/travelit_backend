// src/utils/cloudinary.js
const cloudinary = require('cloudinary').v2;
require('dotenv').config();

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Alternative configuration using CLOUDINARY_URL from .env
// This is often simpler if you have the full URL.
if (process.env.CLOUDINARY_URL) {
    cloudinary.config({
        secure: true
    });
} else {
    console.warn('CLOUDINARY_URL not set. Falling back to individual keys.');
}

module.exports = cloudinary;
