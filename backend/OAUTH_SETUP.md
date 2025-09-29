# OAuth Platform Integration Setup

## Current Status
The integrations are working in **MOCK MODE** - they will connect successfully and show as "Connected" without requiring real OAuth credentials. This allows you to test the UI and functionality.

## To Enable Real OAuth Connections

### 1. Google Services (Calendar, Gmail, Drive)

**Create OAuth Credentials:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable APIs:
   - Google Calendar API
   - Gmail API
   - Google Drive API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URI: `http://localhost:3001/api/v3/integrations/oauth/callback`

**Add to `.env`:**
```bash
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3001/api/v3/integrations/oauth/callback
```

### 2. Microsoft Outlook

**Create App Registration:**
1. Go to [Azure Portal](https://portal.azure.com/)
2. Navigate to "Azure Active Directory" → "App registrations"
3. Click "New registration"
4. Set redirect URI: `http://localhost:3001/api/v3/integrations/oauth/callback`
5. Grant permissions: Mail.Send, Calendars.ReadWrite

**Add to `.env`:**
```bash
MICROSOFT_CLIENT_ID=your_client_id_here
MICROSOFT_CLIENT_SECRET=your_client_secret_here
MICROSOFT_REDIRECT_URI=http://localhost:3001/api/v3/integrations/oauth/callback
```

### 3. Slack

**Create Slack App:**
1. Go to [Slack API](https://api.slack.com/apps)
2. Click "Create New App"
3. Add OAuth Scopes: `chat:write`, `channels:read`
4. Set redirect URI: `http://localhost:3001/api/v3/integrations/oauth/callback`

**Add to `.env`:**
```bash
SLACK_CLIENT_ID=your_client_id_here
SLACK_CLIENT_SECRET=your_client_secret_here
SLACK_REDIRECT_URI=http://localhost:3001/api/v3/integrations/oauth/callback
```

### 4. LinkedIn

**Create LinkedIn App:**
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Create new app
3. Add OAuth Scopes: `r_liteprofile`, `r_emailaddress`, `w_member_social`
4. Set redirect URI: `http://localhost:3001/api/v3/integrations/oauth/callback`

**Add to `.env`:**
```bash
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:3001/api/v3/integrations/oauth/callback
```

## Database Setup

Run this SQL to create the integrations table:

```sql
CREATE TABLE IF NOT EXISTS user_integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    integration_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    account_info TEXT,
    access_token TEXT,
    refresh_token TEXT,
    connected_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, integration_id)
);
```

## How It Works

### Mock Mode (Current)
- No OAuth credentials needed
- Click "Connect" → Immediately shows as connected
- Uses your user email as account info
- Perfect for testing UI/UX

### Real OAuth Mode (With Credentials)
- System detects OAuth credentials in environment
- Click "Connect" → Redirects to provider's auth page
- User authorizes → Redirects back with code
- Backend exchanges code for tokens
- Stores tokens securely for AI Assistant to use

## Testing the Flow

1. **Mock Mode (No Setup):**
   - Just click Connect
   - Integration shows as connected
   - AI can use simulated connections

2. **Real OAuth (With Setup):**
   - Add credentials to `.env`
   - Restart backend server
   - Click Connect
   - Authorize on provider's site
   - Returns to settings page
   - Integration fully connected

## Using Connected Integrations

Once connected (mock or real), the AI Assistant can:
- Send emails through Gmail/Outlook
- Create calendar events
- Access Google Drive
- Post to Slack
- Message on LinkedIn

The AI will automatically use your connected accounts when you ask it to perform tasks like:
- "Send @candidate an interview invite via email"
- "Add interview with @candidate to my calendar"
- "Share candidate profile on LinkedIn"
