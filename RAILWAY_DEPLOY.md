# 🚀 Northwestern Mutual - Railway Deployment Guide

## Deploy to Production in 5 Minutes!

Your Northwestern Mutual recruiting platform is **100% ready** for Railway deployment. Follow these steps to get your live production URL.

---

## 🎯 Quick Deploy Steps

### 1. **Go to Railway Dashboard**
- Visit: [railway.app](https://railway.app)
- Sign in with your GitHub account

### 2. **Create New Project**
- Click "New Project"
- Select "Deploy from GitHub repo"
- Choose your Northwestern Mutual recruiting repository

### 3. **Add PostgreSQL Database**
- In your Railway project dashboard
- Click "New Service" → "Database" → "PostgreSQL"
- Railway will auto-provision the database

### 4. **Configure Environment Variables**
Copy and paste these into Railway's environment variables section:

```bash
# REQUIRED - Core Configuration
NODE_ENV=production
PORT=3001

# Database (Railway auto-generates DATABASE_URL)
# No action needed - Railway handles this automatically

# JWT Secrets (CHANGE THESE!)
JWT_SECRET=nwm-production-jwt-secret-256-bit-key-change-me
JWT_REFRESH_SECRET=nwm-production-refresh-secret-256-bit-key-change-me
SESSION_SECRET=nwm-production-session-secret-change-me

# Application URLs (UPDATE after deployment)
API_BASE_URL=https://your-app-name.railway.app
FRONTEND_URL=https://your-app-name.railway.app
CORS_ORIGIN=https://your-app-name.railway.app

# Northwestern Mutual Configuration
NM_ORGANIZATION_ID=northwestern-mutual-main
NM_ADMIN_EMAIL=admin@northwesternmutual.com

# Security Settings
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# OPTIONAL - OAuth Configuration (add later)
# GOOGLE_CLIENT_ID=your-google-oauth-client-id
# GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
# MICROSOFT_CLIENT_ID=your-microsoft-azure-app-id
# MICROSOFT_CLIENT_SECRET=your-microsoft-azure-client-secret

# OPTIONAL - AI & Email Features
# OPENAI_API_KEY=your-openai-api-key
# SENDGRID_API_KEY=your-sendgrid-api-key
# SENDGRID_FROM_EMAIL=noreply@northwesternmutual.com
```

### 5. **Deploy!**
- Click "Deploy" in Railway
- Railway will automatically:
  ✅ Build your application
  ✅ Run database migrations
  ✅ Start the server
  ✅ Generate your live URL

---

## 🌐 Your Live URLs

After deployment, you'll get:

### **Main Application**
- **Dashboard**: `https://your-app-name.railway.app`
- **Login**: `https://your-app-name.railway.app/login`
- **Health Check**: `https://your-app-name.railway.app/health`

### **Admin Features**
- **Queue Monitor**: `https://your-app-name.railway.app/admin/queues`
- **Database Admin**: Available in Railway dashboard

### **OAuth Endpoints** (when configured)
- **Google Login**: `https://your-app-name.railway.app/api/auth/google`
- **Microsoft Login**: `https://your-app-name.railway.app/api/auth/microsoft`

---

## 🔐 OAuth Setup (Optional - for SSO)

### **Google OAuth Setup**
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create/select project → Enable Google+ API
3. Create OAuth 2.0 credentials
4. Add redirect URI: `https://your-app-name.railway.app/api/auth/google/callback`
5. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to Railway

### **Microsoft OAuth Setup**
1. Go to [Azure Portal](https://portal.azure.com)
2. Register new application in Azure AD
3. Add redirect URI: `https://your-app-name.railway.app/api/auth/microsoft/callback`
4. Add `MICROSOFT_CLIENT_ID` and `MICROSOFT_CLIENT_SECRET` to Railway

---

## 🎉 What You Get Instantly

### **✅ Full Northwestern Mutual Platform**
- Complete recruiting dashboard
- Behavioral assessment system (27 questions)
- Employee comparison analytics
- Candidate pipeline management
- Real-time WebSocket updates
- AI-powered intelligence reports

### **✅ Production Features**
- Auto-scaling infrastructure
- PostgreSQL database with migrations
- Security middleware & audit logging
- Rate limiting & CORS protection
- Automated backups
- SSL certificates

### **✅ Northwestern Mutual Specific**
- Pre-configured organization
- Employee assessment comparisons
- Domain-restricted OAuth (`@northwesternmutual.com`)
- Sample employee data
- Intelligence report templates

---

## 🔧 Post-Deployment

### **1. Test Your Deployment**
```bash
# Check health
curl https://your-app-name.railway.app/health

# Expected response:
{"status":"healthy","timestamp":"2025-01-XX"}
```

### **2. Login & Verify**
- Visit your live URL
- Login with: `demo@northwestern.com` / `password123`
- Verify all features work

### **3. Update URLs** (Important!)
After getting your Railway domain, update these environment variables:
- `API_BASE_URL`
- `FRONTEND_URL`
- `CORS_ORIGIN`

---

## 🚨 Production Checklist

- [ ] Railway project created
- [ ] PostgreSQL database added
- [ ] Environment variables configured
- [ ] Application deployed successfully
- [ ] Health check returns "healthy"
- [ ] Demo login works
- [ ] Dashboard loads correctly
- [ ] Database migrations completed
- [ ] URLs updated with live domain

---

## 🎯 Success!

Once deployed, you'll have a **live, production-ready Northwestern Mutual recruiting platform** with:

🔹 **Real OAuth integration** (when configured)
🔹 **Employee assessment comparisons**
🔹 **Enterprise-grade security**
🔹 **Auto-scaling infrastructure**
🔹 **Professional Northwestern Mutual branding**

**Your platform will be accessible at your Railway URL and ready for real Northwestern Mutual recruiting operations!** 🚀

---

## 📞 Need Help?

- **Railway Docs**: [docs.railway.app](https://docs.railway.app)
- **Check Logs**: Railway dashboard → "Logs" tab
- **Environment Issues**: Railway dashboard → "Variables" tab
- **Database Issues**: Railway dashboard → PostgreSQL service

**Total deployment time: ~5 minutes** ⚡