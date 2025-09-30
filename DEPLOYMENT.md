# Northwestern Mutual Recruiting Platform - Deployment Guide

## 🚀 Railway Production Deployment (Recommended)

### Prerequisites
- Vercel account (team plan recommended for enterprise)
- GitHub repository connected to Vercel
- Environment variables configured
- Backend API deployed and accessible

### Step 1: Environment Configuration

Create environment variables in Vercel dashboard:

```bash
# Frontend Environment Variables
VITE_API_URL=https://your-backend-api.com
VITE_WS_URL=wss://your-backend-api.com

# Build Configuration
NODE_ENV=production
```

### Step 2: Deploy Frontend to Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Login to Vercel
vercel login

# Deploy from root directory
cd /Users/mikeweingarten/Projects/recruiting
vercel --prod

# Or use GitHub integration (recommended)
# Push to main branch and Vercel will auto-deploy
```

### Step 3: Deploy Backend

The backend can be deployed to:
- **Vercel** (serverless functions)
- **Railway** (recommended for PostgreSQL + Redis)
- **Render** (full-stack hosting)
- **AWS EC2** (enterprise-grade)

#### Railway Deployment (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login to Railway
railway login

# Initialize project
cd backend
railway init

# Add PostgreSQL and Redis
railway add postgresql
railway add redis

# Set environment variables
railway variables set JWT_SECRET=your-production-secret
railway variables set OPENAI_API_KEY=your-openai-key
railway variables set SENDGRID_API_KEY=your-sendgrid-key

# Deploy
railway up
```

### Step 4: Database Setup

```bash
# Connect to production database
psql $DATABASE_URL

# Run migrations
\i backend/utils/database-setup.sql
\i backend/migrations/*.sql

# Verify schema
\dt

# Create admin user
INSERT INTO users (email, password_hash, first_name, last_name, role, organization_id)
VALUES ('admin@northwestern.com', '$2b$10$hashed_password', 'Admin', 'User', 'admin', 1);
```

### Step 5: Security Checklist

- [ ] All JWT secrets changed from development defaults
- [ ] API keys stored in environment variables (not code)
- [ ] CORS configured for production domain only
- [ ] Rate limiting enabled on all API endpoints
- [ ] Database credentials rotated
- [ ] SSL/TLS certificates configured
- [ ] Content Security Policy headers set
- [ ] SQL injection protection verified
- [ ] XSS protection enabled
- [ ] CSRF tokens implemented for forms

### Step 6: Performance Optimization

```bash
# Build optimized frontend
cd client
npm run build

# Verify build size
ls -lh dist/assets/

# Test production build locally
npm run preview

# Run Lighthouse audit
npx lighthouse http://localhost:4173 --view
```

### Step 7: Monitoring & Logging

Set up monitoring services:

1. **Vercel Analytics** - Built-in performance monitoring
2. **Sentry** - Error tracking and alerting
3. **LogRocket** - Session replay and debugging
4. **DataDog** - Infrastructure monitoring

```bash
# Install Sentry
npm install @sentry/react @sentry/vite-plugin

# Configure in vite.config.ts
import { sentryVitePlugin } from "@sentry/vite-plugin";

export default defineConfig({
  plugins: [
    react(),
    sentryVitePlugin({
      org: "northwestern-mutual",
      project: "recruiting-platform",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
  ],
});
```

### Step 8: DNS Configuration

Point your domain to Vercel:

```
Type    Name    Value
A       @       76.76.21.21
CNAME   www     cname.vercel-dns.com
```

### Step 9: Post-Deployment Testing

Run comprehensive tests:

```bash
# Functional tests
- [ ] Login/logout flow
- [ ] Candidate creation
- [ ] Assessment completion
- [ ] AI chat responses
- [ ] Pipeline drag-and-drop
- [ ] Email notifications
- [ ] Real-time updates (WebSocket)

# Performance tests
- [ ] Page load < 3 seconds
- [ ] Time to Interactive < 2 seconds
- [ ] Lighthouse score > 90
- [ ] No JavaScript errors in console
- [ ] Mobile responsive on all pages

# Security tests
- [ ] SQL injection attempts blocked
- [ ] XSS attempts blocked
- [ ] Unauthorized API access denied
- [ ] MFA working correctly
- [ ] Session timeout working
```

### Step 10: Rollback Plan

If deployment fails:

```bash
# Revert to previous deployment
vercel rollback

# Or redeploy specific commit
vercel --prod --commit abc123
```

### Maintenance Mode

To enable maintenance mode:

```bash
# Create maintenance.html in public/
# Update vercel.json to redirect all traffic
{
  "routes": [
    { "src": "/(.*)", "dest": "/maintenance.html" }
  ]
}
```

## 🔧 Troubleshooting

### Build Fails
```bash
# Clear Vercel cache
vercel --force

# Check build logs
vercel logs

# Test build locally
npm run build
```

### API Connection Issues
```bash
# Verify environment variables
vercel env pull

# Test API endpoint
curl https://your-api.com/health

# Check CORS configuration
```

### Database Connection Issues
```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check connection pool limits
```

## 📊 Performance Benchmarks

Target metrics for production:
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3.5s
- **Cumulative Layout Shift**: < 0.1
- **API Response Time**: < 200ms (95th percentile)
- **WebSocket Latency**: < 100ms

## 🔒 Compliance

Ensure compliance with:
- **GDPR** - Data protection and privacy
- **CCPA** - California consumer privacy
- **SOC 2** - Security and availability
- **HIPAA** - If handling health data (assessments)

## 📞 Support

For deployment issues:
- Email: devops@northwestern.com
- Slack: #recruiting-platform-ops
- On-call: +1 (800) NM-DEVOPS

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Owner**: Northwestern Mutual Engineering Team