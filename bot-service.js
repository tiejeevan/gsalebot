const fetch = require('node-fetch');

/**
 * Robust Bot Service for automated actions
 * Handles authentication, messaging, commenting, and error recovery
 */
class BotService {
    constructor(config) {
        this.baseUrl = config.baseUrl || 'http://localhost:5001';
        this.username = config.username;
        this.password = config.password;
        this.token = null;
        this.userId = null;
        this.activityLog = [];
        this.errorCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 2000; // 2 seconds
    }

    /**
     * Sleep utility for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Log activity with timestamp
     */
    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = { timestamp, message, type };
        this.activityLog.push(logEntry);
        
        const emoji = {
            info: 'ℹ️',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[type] || 'ℹ️';
        
        console.log(`${emoji} [${timestamp}] ${message}`);
    }

    /**
     * Authenticate and get JWT token
     */
    async authenticate() {
        try {
            this.log(`Authenticating as "${this.username}"...`);
            
            const response = await fetch(`${this.baseUrl}/api/auth/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: this.username,
                    password: this.password
                })
            });

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`Authentication failed: ${error}`);
            }

            const data = await response.json();
            this.token = data.token;
            this.userId = data.user.id;
            
            this.log(`Authenticated successfully! User ID: ${this.userId}`, 'success');
            return true;
        } catch (error) {
            this.log(`Authentication error: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Make authenticated API request with retry logic
     */
    async makeRequest(endpoint, options = {}, retryCount = 0) {
        try {
            // Ensure we're authenticated
            if (!this.token) {
                await this.authenticate();
            }

            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers: {
                    ...options.headers,
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                }
            });

            // Handle token expiration
            if (response.status === 401) {
                this.log('Token expired, re-authenticating...', 'warning');
                this.token = null;
                await this.authenticate();
                return this.makeRequest(endpoint, options, retryCount);
            }

            if (!response.ok) {
                const error = await response.text();
                throw new Error(`API Error (${response.status}): ${error}`);
            }

            return await response.json();
        } catch (error) {
            if (retryCount < this.maxRetries) {
                this.log(`Request failed, retrying (${retryCount + 1}/${this.maxRetries})...`, 'warning');
                await this.sleep(this.retryDelay);
                return this.makeRequest(endpoint, options, retryCount + 1);
            }
            throw error;
        }
    }

    /**
     * Get list of active users (excluding self)
     */
    async getActiveUsers() {
        try {
            // Search for users with common letters (requires min 2 chars)
            const searchQueries = ['er', 'an', 'on', 'in', 'ar', 'te', 'st'];
            const randomQuery = searchQueries[Math.floor(Math.random() * searchQueries.length)];
            
            const data = await this.makeRequest(`/api/users/search?q=${randomQuery}`);
            
            // Handle different response formats
            let users = Array.isArray(data) ? data : (data.users || data.results || []);
            
            // Filter out self
            users = users.filter(u => u.id !== this.userId);
            
            if (users.length === 0) {
                this.log('No active users found', 'warning');
            }
            
            return users;
        } catch (error) {
            this.log(`Error fetching users: ${error.message}`, 'error');
            return [];
        }
    }

    /**
     * Get random user from list
     */
    getRandomUser(users) {
        if (!users || users.length === 0) return null;
        return users[Math.floor(Math.random() * users.length)];
    }

    /**
     * Get or create direct chat with a user
     */
    async getOrCreateChat(userId) {
        try {
            const data = await this.makeRequest('/api/chats/direct', {
                method: 'POST',
                body: JSON.stringify({ otherUserId: userId })
            });
            
            return data.chatId;
        } catch (error) {
            this.log(`Error creating chat with user ${userId}: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Send message to a user
     */
    async sendMessage(userId, username) {
        try {
            // Get or create chat
            const chatId = await this.getOrCreateChat(userId);
            
            // Generate random message
            const messages = [
                'Hey! How are you doing?',
                'Just checking in! 👋',
                'Hope you\'re having a great day!',
                'What\'s new with you?',
                'Greetings from the bot! 🤖',
                'Random message incoming!',
                'Testing the chat system!',
                'Bot says hello! 👋',
                'Automated message #' + Math.floor(Math.random() * 1000),
                'Beep boop! 🤖'
            ];
            
            const content = messages[Math.floor(Math.random() * messages.length)];
            
            // Send message
            await this.makeRequest(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({
                    content,
                    type: 'text'
                })
            });
            
            this.log(`Sent message to @${username} (ID: ${userId}): "${content}"`, 'success');
            this.errorCount = 0; // Reset error count on success
            
            return {
                success: true,
                action: 'message',
                target: username,
                content,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.errorCount++;
            this.log(`Failed to send message to @${username}: ${error.message}`, 'error');
            return {
                success: false,
                action: 'message',
                target: username,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Get list of posts
     */
    async getPosts() {
        try {
            const data = await this.makeRequest('/api/posts');
            
            // Handle different response formats
            let posts = Array.isArray(data) ? data : (data.posts || []);
            
            // Filter out deleted posts and posts by self
            posts = posts.filter(p => !p.is_deleted && p.user_id !== this.userId);
            
            if (posts.length === 0) {
                this.log('No posts available to comment on', 'warning');
            }
            
            return posts;
        } catch (error) {
            this.log(`Error fetching posts: ${error.message}`, 'error');
            return [];
        }
    }

    /**
     * Get random post from list
     */
    getRandomPost(posts) {
        if (!posts || posts.length === 0) return null;
        return posts[Math.floor(Math.random() * posts.length)];
    }

    /**
     * Comment on a post
     */
    async commentOnPost(postId, postOwner) {
        try {
            // Generate random comment
            const comments = [
                'Great post! 👍',
                'Interesting perspective!',
                'Thanks for sharing!',
                'Love this! ❤️',
                'Very insightful!',
                'Couldn\'t agree more!',
                'This is awesome! 🔥',
                'Well said!',
                'Bot approved! ✅',
                'Random comment #' + Math.floor(Math.random() * 1000)
            ];
            
            const content = comments[Math.floor(Math.random() * comments.length)];
            
            // Post comment
            await this.makeRequest('/api/comments', {
                method: 'POST',
                body: JSON.stringify({
                    post_id: postId,
                    content
                })
            });
            
            this.log(`Commented on post ${postId} by @${postOwner}: "${content}"`, 'success');
            this.errorCount = 0; // Reset error count on success
            
            return {
                success: true,
                action: 'comment',
                target: `post ${postId} by @${postOwner}`,
                content,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            this.errorCount++;
            this.log(`Failed to comment on post ${postId}: ${error.message}`, 'error');
            return {
                success: false,
                action: 'comment',
                target: `post ${postId}`,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Send activity report to another user
     */
    async sendReport(reportUserId, reportUsername, activity) {
        try {
            const chatId = await this.getOrCreateChat(reportUserId);
            
            let message;
            if (activity.success) {
                if (activity.action === 'message') {
                    message = `✅ Sent message to @${activity.target}: "${activity.content}"`;
                } else if (activity.action === 'comment') {
                    message = `✅ Commented on ${activity.target}: "${activity.content}"`;
                }
            } else {
                message = `❌ Failed to ${activity.action} ${activity.target}: ${activity.error}`;
            }
            
            await this.makeRequest(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                body: JSON.stringify({
                    content: message,
                    type: 'text'
                })
            });
            
            this.log(`Sent report to @${reportUsername}`, 'success');
        } catch (error) {
            this.log(`Failed to send report to @${reportUsername}: ${error.message}`, 'error');
        }
    }

    /**
     * Get activity statistics
     */
    getStats() {
        const total = this.activityLog.length;
        const successes = this.activityLog.filter(a => a.type === 'success').length;
        const errors = this.activityLog.filter(a => a.type === 'error').length;
        
        return {
            total,
            successes,
            errors,
            successRate: total > 0 ? ((successes / total) * 100).toFixed(2) + '%' : '0%'
        };
    }

    /**
     * Check if bot is healthy
     */
    isHealthy() {
        // Consider unhealthy if more than 5 consecutive errors
        return this.errorCount < 5;
    }
}

module.exports = BotService;
