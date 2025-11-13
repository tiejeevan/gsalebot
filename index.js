#!/usr/bin/env node

/**
 * Bot Cop - Standalone Automated Bot (Web Service Mode)
 * 
 * Features:
 * - Sends messages to random users every 2 minutes
 * - Comments on random posts every 2 minutes (alternating with messages)
 * - Reports all activities to user "phone"
 * - Robust error handling and recovery
 * - Health monitoring
 * - Graceful shutdown
 * - HTTP server for Render.com free tier compatibility
 */

const http = require('http');
const BotService = require('./bot-service');

// Configuration from environment variables
const CONFIG = {
    baseUrl: process.env.BOT_BASE_URL || 'http://localhost:5001',
    copUsername: process.env.BOT_USERNAME || 'cop',
    copPassword: process.env.BOT_PASSWORD || '123456',
    phoneUsername: process.env.REPORT_USERNAME || 'phone',
    intervalMinutes: parseInt(process.env.INTERVAL_MINUTES || '2'),
    healthCheckInterval: 30000, // 30 seconds
    port: parseInt(process.env.PORT || '3000'), // HTTP server port
};

// Bot instances
let copBot = null;
let phoneUserId = null;
let phoneUsername = CONFIG.phoneUsername;
let isRunning = false;
let messageInterval = null;
let commentInterval = null;
let healthCheckInterval = null;

/**
 * Initialize the bot system
 */
async function initialize() {
    console.log('🤖 Initializing Bot Cop System...\n');
    console.log('Configuration:');
    console.log(`  Base URL: ${CONFIG.baseUrl}`);
    console.log(`  Bot User: ${CONFIG.copUsername}`);
    console.log(`  Report User: ${CONFIG.phoneUsername}`);
    console.log(`  Interval: Every ${CONFIG.intervalMinutes} minutes\n`);

    try {
        // Create bot service instance
        copBot = new BotService({
            baseUrl: CONFIG.baseUrl,
            username: CONFIG.copUsername,
            password: CONFIG.copPassword
        });

        // Authenticate
        await copBot.authenticate();

        // Get phone user ID by searching
        const searchResult = await copBot.makeRequest(`/api/users/search?q=${CONFIG.phoneUsername}`);
        const users = searchResult.users || [];
        const phoneUser = users.find(u => u.username === CONFIG.phoneUsername);

        if (!phoneUser) {
            console.log(`⚠️  Warning: Report user "${CONFIG.phoneUsername}" not found. Reports will be skipped.`);
            phoneUserId = null;
        } else {
            phoneUserId = phoneUser.id;
            phoneUsername = phoneUser.username;
            console.log(`✅ Initialization complete!\n`);
            console.log(`📱 Reports will be sent to @${phoneUsername} (ID: ${phoneUserId})\n`);
        }

        return true;
    } catch (error) {
        console.error('❌ Initialization failed:', error.message);
        throw error;
    }
}

/**
 * Send message to random user
 */
async function sendRandomMessage() {
    if (!copBot.isHealthy()) {
        copBot.log('Bot is unhealthy, skipping message action', 'warning');
        return;
    }

    try {
        copBot.log('🔍 Fetching active users...');
        const users = await copBot.getActiveUsers();

        if (users.length === 0) {
            copBot.log('No users available to message', 'warning');
            return;
        }

        const randomUser = copBot.getRandomUser(users);
        copBot.log(`🎯 Selected user: @${randomUser.username} (ID: ${randomUser.id})`);

        const result = await copBot.sendMessage(randomUser.id, randomUser.username);

        // Send report to phone
        if (phoneUserId) {
            await copBot.sendReport(phoneUserId, phoneUsername, result);
        }
    } catch (error) {
        copBot.log(`Error in sendRandomMessage: ${error.message}`, 'error');
    }
}

/**
 * Comment on random post
 */
async function commentOnRandomPost() {
    if (!copBot.isHealthy()) {
        copBot.log('Bot is unhealthy, skipping comment action', 'warning');
        return;
    }

    try {
        copBot.log('🔍 Fetching posts...');
        const posts = await copBot.getPosts();

        if (posts.length === 0) {
            copBot.log('No posts available to comment on', 'warning');
            return;
        }

        const randomPost = copBot.getRandomPost(posts);
        copBot.log(`🎯 Selected post: ID ${randomPost.id} by @${randomPost.username}`);

        const result = await copBot.commentOnPost(randomPost.id, randomPost.username);

        // Send report to phone
        if (phoneUserId) {
            await copBot.sendReport(phoneUserId, phoneUsername, result);
        }
    } catch (error) {
        copBot.log(`Error in commentOnRandomPost: ${error.message}`, 'error');
    }
}

/**
 * Health check and status report
 */
async function performHealthCheck() {
    const stats = copBot.getStats();
    const isHealthy = copBot.isHealthy();

    console.log('\n📊 Bot Health Status:');
    console.log(`  Status: ${isHealthy ? '✅ Healthy' : '❌ Unhealthy'}`);
    console.log(`  Total Actions: ${stats.total}`);
    console.log(`  Successes: ${stats.successes}`);
    console.log(`  Errors: ${stats.errors}`);
    console.log(`  Success Rate: ${stats.successRate}`);
    console.log(`  Consecutive Errors: ${copBot.errorCount}\n`);

    // If unhealthy, try to recover
    if (!isHealthy) {
        copBot.log('Bot is unhealthy, attempting recovery...', 'warning');
        try {
            await copBot.authenticate();
            copBot.errorCount = 0;
            copBot.log('Recovery successful!', 'success');
        } catch (error) {
            copBot.log(`Recovery failed: ${error.message}`, 'error');
        }
    }
}

/**
 * Start the bot
 */
async function start() {
    if (isRunning) {
        console.log('⚠️  Bot is already running!');
        return;
    }

    try {
        await initialize();
        isRunning = true;

        const intervalMs = CONFIG.intervalMinutes * 60 * 1000;

        console.log('🚀 Starting Bot Cop...\n');
        console.log(`⏰ Message interval: Every ${CONFIG.intervalMinutes} minutes`);
        console.log(`⏰ Comment interval: Every ${CONFIG.intervalMinutes} minutes (offset by 1 minute)\n`);

        // Send initial message immediately
        await sendRandomMessage();

        // Set up message interval (every 2 minutes)
        messageInterval = setInterval(async () => {
            console.log('\n' + '='.repeat(60));
            console.log('💬 MESSAGE ACTION');
            console.log('='.repeat(60) + '\n');
            await sendRandomMessage();
        }, intervalMs);

        // Set up comment interval (every 2 minutes, offset by 1 minute)
        setTimeout(() => {
            // Send initial comment after 1 minute
            (async () => {
                console.log('\n' + '='.repeat(60));
                console.log('💭 COMMENT ACTION');
                console.log('='.repeat(60) + '\n');
                await commentOnRandomPost();
            })();

            // Then repeat every 2 minutes
            commentInterval = setInterval(async () => {
                console.log('\n' + '='.repeat(60));
                console.log('💭 COMMENT ACTION');
                console.log('='.repeat(60) + '\n');
                await commentOnRandomPost();
            }, intervalMs);
        }, 60 * 1000); // 1 minute offset

        // Set up health check
        healthCheckInterval = setInterval(performHealthCheck, CONFIG.healthCheckInterval);

        console.log('✅ Bot Cop is now running!');
        console.log('Press Ctrl+C to stop.\n');

        // Start HTTP server for Render.com
        startHttpServer();

    } catch (error) {
        console.error('❌ Failed to start bot:', error.message);
        process.exit(1);
    }
}

/**
 * Start HTTP server for health checks and keeping service alive
 */
function startHttpServer() {
    const server = http.createServer((req, res) => {
        const url = req.url;

        // Health check endpoint
        if (url === '/' || url === '/health') {
            const stats = copBot ? copBot.getStats() : { total: 0, successes: 0, errors: 0 };
            const isHealthy = copBot ? copBot.isHealthy() : false;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'running',
                healthy: isHealthy,
                uptime: process.uptime(),
                stats: stats,
                message: '🤖 Bot Cop is running!'
            }));
        }
        // Status endpoint
        else if (url === '/status') {
            const stats = copBot ? copBot.getStats() : { total: 0, successes: 0, errors: 0 };
            
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Bot Cop Status</title>
                    <style>
                        body { font-family: Arial; max-width: 600px; margin: 50px auto; padding: 20px; }
                        h1 { color: #333; }
                        .stat { background: #f0f0f0; padding: 10px; margin: 10px 0; border-radius: 5px; }
                        .healthy { color: green; }
                        .unhealthy { color: red; }
                    </style>
                </head>
                <body>
                    <h1>🤖 Bot Cop Status</h1>
                    <div class="stat">Status: <strong class="${copBot && copBot.isHealthy() ? 'healthy' : 'unhealthy'}">${copBot && copBot.isHealthy() ? '✅ Healthy' : '❌ Unhealthy'}</strong></div>
                    <div class="stat">Uptime: <strong>${Math.floor(process.uptime())} seconds</strong></div>
                    <div class="stat">Total Actions: <strong>${stats.total}</strong></div>
                    <div class="stat">Successes: <strong>${stats.successes}</strong></div>
                    <div class="stat">Errors: <strong>${stats.errors}</strong></div>
                    <div class="stat">Success Rate: <strong>${stats.successRate}</strong></div>
                    <p><em>Bot sends messages and comments every ${CONFIG.intervalMinutes} minutes</em></p>
                </body>
                </html>
            `);
        }
        // 404
        else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
        }
    });

    server.listen(CONFIG.port, '0.0.0.0', () => {
        console.log(`\n🌐 HTTP Server running on port ${CONFIG.port}`);
        console.log(`   Health check: http://localhost:${CONFIG.port}/health`);
        console.log(`   Status page: http://localhost:${CONFIG.port}/status\n`);
    });
}

/**
 * Stop the bot gracefully
 */
async function stop() {
    if (!isRunning) {
        return;
    }

    console.log('\n\n🛑 Stopping Bot Cop...');

    isRunning = false;

    // Clear intervals
    if (messageInterval) clearInterval(messageInterval);
    if (commentInterval) clearInterval(commentInterval);
    if (healthCheckInterval) clearInterval(healthCheckInterval);

    // Print final stats
    if (copBot) {
        console.log('\n📊 Final Statistics:');
        const stats = copBot.getStats();
        console.log(`  Total Actions: ${stats.total}`);
        console.log(`  Successes: ${stats.successes}`);
        console.log(`  Errors: ${stats.errors}`);
        console.log(`  Success Rate: ${stats.successRate}`);
    }

    console.log('\n✅ Bot Cop stopped gracefully.\n');
    process.exit(0);
}

/**
 * Handle graceful shutdown
 */
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

// Handle uncaught errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    stop();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
    stop();
});

// Start the bot
if (require.main === module) {
    start().catch((error) => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = { start, stop };
