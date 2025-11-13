# GSale Bot - Standalone Automated Bot

Automated bot that sends messages to random users and comments on posts.

## Features

- 🤖 Sends messages to random users every 2 minutes
- 💬 Comments on random posts every 2 minutes (alternating)
- 📱 Reports all activities to a designated user
- 🔄 Automatic error recovery
- 📊 Health monitoring
- 🛡️ Graceful shutdown

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```env
BOT_BASE_URL=https://your-backend-url.com
BOT_USERNAME=cop
BOT_PASSWORD=123456
REPORT_USERNAME=phone
INTERVAL_MINUTES=2
```

### 3. Run the Bot

**Development:**
```bash
npm start
```

**Production:**
```bash
node index.js
```

## Deployment to Render.com (FREE)

1. Create a new **Web Service** (FREE tier available!)
2. Connect your repository
3. Set build command: `npm install`
4. Set start command: `npm start`
5. Add environment variables:
   - `BOT_BASE_URL` - Your backend API URL
   - `BOT_USERNAME` - Bot username (default: cop)
   - `BOT_PASSWORD` - Bot password (default: 123456)
   - `REPORT_USERNAME` - User to receive reports (default: phone)
   - `INTERVAL_MINUTES` - Interval in minutes (default: 2)
6. The bot will run continuously and respond to HTTP requests at `/health` and `/status`

## How It Works

1. Bot authenticates with the backend API
2. Starts an HTTP server (for Render.com free tier)
3. Every 2 minutes, it sends a message to a random user
4. Every 2 minutes (offset by 1 minute), it comments on a random post
5. All activities are reported to the designated user
6. Health checks run every 30 seconds
7. Automatic recovery if errors occur

## Endpoints

- `GET /` or `GET /health` - JSON health check
- `GET /status` - HTML status page with statistics

## Requirements

- Node.js 14+
- Backend API with users "cop" and "phone" created
- Backend must be running and accessible

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `BOT_BASE_URL` | Backend API URL | `http://localhost:5001` |
| `BOT_USERNAME` | Bot username | `cop` |
| `BOT_PASSWORD` | Bot password | `123456` |
| `REPORT_USERNAME` | User to receive reports | `phone` |
| `INTERVAL_MINUTES` | Action interval in minutes | `2` |
| `PORT` | HTTP server port | `3000` |

## Stopping the Bot

Press `Ctrl+C` to gracefully stop the bot. It will display final statistics before exiting.
