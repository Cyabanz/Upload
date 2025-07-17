const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Health check endpoint for Render
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'discord-link-checker-bot'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'Discord Link Checker & Global Chat Bot',
        description: 'A comprehensive Discord bot with link checking, global chat, and user verification',
        features: [
            'Link Checking & Malware Detection',
            'Global Chat Network',
            'User Phone Verification (Yggdrasil-like)',
            'Profanity Filtering',
            'Admin Moderation Tools'
        ],
        status: 'running'
    });
});

// Start the HTTP server
app.listen(port, () => {
    console.log(`HTTP server running on port ${port}`);
});

// Start the Discord bot
require('./index.js');