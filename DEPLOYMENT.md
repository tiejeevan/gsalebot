# Deployment Guide - GSale Bot

## Deploy to Render.com

### Step 1: Push to GitHub

```bash
cd gsalebot
git init
git add .
git commit -m "Initial bot commit"
git remote add origin <your-repo-url>
git push -u origin main
```

### Step 2: Create Render Service

1. Go to [Render.com Dashboard](https://dashboard.render.com/)
2. Click **"New +"** → **"Web Service"** (FREE tier available!)
3. Connect your GitHub repository
4. Configure:
   - **Name**: `gsalebot` (or any name you prefer)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: **Free** ← Select this!

### Step 3: Add Environment Variables

In Render dashboard, add these environment variables:

| Key | Value | Example |
|-----|-------|---------|
| `BOT_BASE_URL` | Your backend API URL | `https://your-backend.onrender.com` |
| `BOT_USERNAME` | Bot username | `cop` |
| `BOT_PASSWORD` | Bot password | `123456` |
| `REPORT_USERNAME` | Report recipient | `phone` |
| `INTERVAL_MINUTES` | Action interval | `2` |

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will automatically:
   - Clone your repository
   - Run `npm install`
   - Start the bot with `npm start`
   - Assign a public URL (e.g., `https://gsalebot.onrender.com`)

### Step 5: Monitor

- **View logs**: Render dashboard
- **Check bot activity**: Login as "phone" in your app to see reports
- **Health check**: Visit `https://your-bot-url.onrender.com/health`
- **Status page**: Visit `https://your-bot-url.onrender.com/status`
- Bot will auto-restart if it crashes

### Step 6: Keep It Alive (Optional)

Render free tier spins down after 15 minutes of inactivity. To keep it alive:

**Option 1: Use a ping service (Recommended)**
- [UptimeRobot](https://uptimerobot.com/) - Free, pings every 5 minutes
- [Cron-job.org](https://cron-job.org/) - Free, customizable intervals
- Set it to ping: `https://your-bot-url.onrender.com/health`

**Option 2: Self-ping**
The bot can ping itself, but this uses your free tier hours.

## Important Notes

### Before Deployment

1. **Create bot users** in your backend database:
   ```bash
   # Run this in your backend project
   node scripts/create-bot-users.js
   ```

2. **Ensure backend is deployed** and accessible at the URL you'll use for `BOT_BASE_URL`

3. **Test locally first**:
   ```bash
   BOT_BASE_URL=https://your-backend.onrender.com npm start
   ```

### After Deployment

- Bot starts automatically when deployed
- Runs continuously 24/7
- Auto-restarts on errors
- Health checks every 30 seconds
- Graceful shutdown on redeploy

### Troubleshooting

**Bot not starting?**
- Check environment variables are set correctly
- Verify backend URL is accessible
- Check logs for authentication errors

**Bot not finding users/posts?**
- Ensure users "cop" and "phone" exist in database
- Check backend API is responding
- Verify JWT token is valid

**Bot keeps crashing?**
- Check backend is running
- Verify database connection
- Review error logs in Render dashboard

## Scaling

To adjust bot behavior:

1. **Change interval**: Update `INTERVAL_MINUTES` env var
2. **Multiple bots**: Deploy multiple instances with different usernames
3. **Different actions**: Modify `index.js` and redeploy

## Cost

- **Free tier**: Render free plan (spins down after 15 min inactivity)
- **Paid tier**: $7/month for always-on background worker

## Monitoring

Monitor bot activity:
1. Login as user "phone" in your app
2. Check messages for bot activity reports
3. View Render logs for technical details
