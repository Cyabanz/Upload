# Discord Link Checker & Global Chat Bot

A comprehensive Discord bot featuring link checking, global chat functionality, user phone verification (Yggdrasil-like system), and advanced moderation tools. Built with Discord.js and designed to be hosted on Render.

## 🌟 Features

### 🔗 Advanced Link Checking
- Real-time URL analysis and threat detection
- Automatic detection of suspicious domains and shortened URLs
- Phishing pattern recognition
- Configurable link filtering with auto-moderation
- Detailed logging of suspicious activities

### 🌐 Global Chat Network
- Cross-server messaging system using webhooks
- Server-specific configuration and management
- Professional ban/unban system with reason tracking
- Message filtering and profanity detection
- Real-time statistics and monitoring

### 📱 User Phone Verification (Yggdrasil-like)
- Secure phone number registration system
- SMS-style verification codes (demo via DM)
- Enhanced security for verified users
- Persistent user profiles with verification status

### 🛡️ Moderation & Security
- PurgoMalum API integration for profanity filtering
- Automatic message deletion for severe violations
- Admin command system with permission levels
- Comprehensive logging and reporting

### ⚙️ Additional Features
- Scheduled cleanup tasks
- Database-driven configuration
- Graceful error handling
- Performance monitoring
- Easy deployment on Render

## 🚀 Quick Start

### Prerequisites
- Node.js 16.0.0 or higher
- Discord bot token
- Render account (for hosting)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <your-repo-url>
   cd discord-link-checker-globalchat-bot
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   DISCORD_TOKEN=your_discord_bot_token_here
   BOT_OWNER_ID=your_discord_user_id
   PREFIX=!
   # ... other variables
   ```

4. **Run the bot:**
   ```bash
   npm start
   ```

## 🌐 Deploying to Render

1. **Fork this repository** to your GitHub account

2. **Create a new Web Service** on Render:
   - Connect your GitHub repository
   - Use the following settings:
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`

3. **Set environment variables** in Render dashboard:
   - `DISCORD_TOKEN`: Your Discord bot token
   - `BOT_OWNER_ID`: Your Discord user ID
   - Other variables as needed (see `.env.example`)

4. **Deploy** and your bot will be live!

## 📖 Commands

### 🌐 Global Chat Commands
- `!globalchat enable [#channel]` - Enable global chat in specified channel
- `!globalchat disable` - Disable global chat
- `!globalchat stats` - View network statistics
- `!globalchat ban <user_id> [reason]` - Ban user from global chat (Admin only)
- `!globalchat unban <user_id>` - Unban user from global chat (Admin only)
- `!globalchat help` - Show global chat help

### 📱 User Phone Commands
- `!userphone register <phone_number>` - Register phone number
- `!userphone verify <code>` - Verify phone with code
- `!userphone status` - Check verification status
- `!userphone update <new_phone>` - Update phone number
- `!userphone help` - Show phone system help

### 🔗 Link Checking Commands
- `!linkcheck <url>` - Manually check a URL for threats
- Automatic scanning of all messages (configurable)

### ⚙️ General Commands
- `!help` - Show comprehensive help message
- `!ping` - Check bot latency and uptime
- `!stats` - View detailed bot statistics

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DISCORD_TOKEN` | Discord bot token | Required |
| `BOT_OWNER_ID` | Bot owner's Discord user ID | Required |
| `PREFIX` | Command prefix | `!` |
| `DB_PATH` | SQLite database path | `./database.sqlite` |
| `LINK_CHECK_ENABLED` | Enable link checking | `true` |
| `GLOBAL_CHAT_ENABLED` | Enable global chat | `true` |
| `PROFANITY_API_URL` | PurgoMalum API URL | PurgoMalum service |
| `PORT` | HTTP server port (for Render) | `3000` |

### Database Schema

The bot uses SQLite with the following tables:
- `global_chat_settings` - Server global chat configurations
- `global_chat_bans` - Global chat ban records
- `user_profiles` - User phone verification data
- `suspicious_links` - Detected suspicious link logs
- `server_admins` - Server-specific admin permissions

## 🛡️ Security Features

### Link Protection
- **Domain Analysis**: Checks against known malicious domains
- **URL Expansion**: Follows redirects to reveal final destinations
- **Pattern Recognition**: Detects phishing keywords and patterns
- **Real-time Scanning**: Analyzes all messages automatically

### Profanity Filtering
- **API Integration**: Uses PurgoMalum for accurate detection
- **Severity Levels**: Different actions based on content severity
- **Custom Word Lists**: Configurable additional filtering
- **Global Chat Protection**: Filters content in cross-server chat

### User Verification
- **Phone Verification**: Yggdrasil-inspired phone validation system
- **Verification Codes**: Secure 6-digit verification process
- **Persistent Storage**: Database-backed user verification status
- **Enhanced Permissions**: Verified users get additional privileges

## 📊 Monitoring & Logging

- **Performance Metrics**: CPU, memory, and response time monitoring
- **Activity Logs**: Comprehensive logging of bot activities
- **Error Tracking**: Detailed error reporting and handling
- **Statistics Dashboard**: Real-time statistics via bot commands

## 🔄 Maintenance

### Automated Tasks
- **Code Cleanup**: Removes expired verification codes every 6 hours
- **Webhook Validation**: Checks and removes invalid webhooks
- **Database Optimization**: Periodic database maintenance

### Manual Maintenance
- **Update Dependencies**: Regular security updates
- **Monitor Logs**: Check for errors and performance issues
- **Backup Database**: Regular SQLite database backups

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -am 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Issues**: Report bugs or request features via GitHub Issues
- **Documentation**: Check this README for detailed information
- **Community**: Join our support Discord server (if available)

## 🙏 Acknowledgments

- **Discord.js**: Powerful Discord API library
- **PurgoMalum**: Free profanity filtering API
- **Render**: Excellent hosting platform for Discord bots
- **FilterCheckerV2**: Inspiration from the GitLab project

---

**Built with ❤️ for the Discord community**

Keep your servers safe and connected! 🛡️🌐