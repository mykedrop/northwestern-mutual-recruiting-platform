# Railway Environment Variables Setup

## Required Environment Variables for Production

After adding the PostgreSQL database to your Railway project, you need to configure these environment variables in your Railway dashboard:

### 1. Database Configuration
The PostgreSQL service will automatically provide:
- `DATABASE_URL` (automatically set by Railway when you add PostgreSQL)

### 2. Application Configuration
Add these in your Railway project's Variables section:

```bash
# Node.js Environment
NODE_ENV=production
PORT=8000

# JWT Authentication
JWT_SECRET=your-super-secure-jwt-secret-at-least-32-characters-long
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-different-from-jwt-secret

# Session Configuration
SESSION_SECRET=your-super-secure-session-secret-for-express-sessions

# Application Settings
CORS_ORIGIN=https://intelliflow-recruiting-production.up.railway.app
```

### 3. Optional API Keys (for full functionality)
```bash
# AI Integration (optional)
OPENAI_API_KEY=your-openai-api-key

# Email Service (optional)
SENDGRID_API_KEY=your-sendgrid-api-key

# Google Search (optional)
GOOGLE_CSE_API_KEY=your-google-cse-api-key
GOOGLE_CSE_ID=your-google-cse-id

# OAuth Configuration (optional)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-oauth-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-oauth-client-secret

# Job Board APIs (optional)
INDEED_API_KEY=your-indeed-api-key
ZIPRECRUITER_API_KEY=your-ziprecruiter-api-key

# SMS Service (optional)
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=your-twilio-phone-number
```

## How to Add Environment Variables

1. **Go to Railway Dashboard**: https://railway.app/dashboard
2. **Open your "intelliflow-recruiting" project**
3. **Click on your main service** (the one running your Node.js app)
4. **Go to the "Variables" tab**
5. **Click "New Variable"** for each variable above
6. **Add the variable name and value**
7. **Click "Deploy"** after adding all variables

## Minimum Required Variables for Basic Functionality

For the application to start successfully, you need at minimum:

```bash
NODE_ENV=production
JWT_SECRET=northwestern-mutual-recruiting-platform-jwt-secret-2024
JWT_REFRESH_SECRET=northwestern-mutual-recruiting-platform-refresh-secret-2024
SESSION_SECRET=northwestern-mutual-recruiting-platform-session-secret-2024
```

## Next Steps

1. Add the PostgreSQL database service to your Railway project
2. Configure the minimum required environment variables above
3. Deploy the application
4. Test the application at your Railway domain
5. Add optional API keys as needed for full functionality

The application will automatically create database tables on first startup using the migration system.