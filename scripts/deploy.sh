#!/bin/bash

# Northwestern Mutual Recruiting Platform - Railway Deployment Script
set -e

echo "🚀 Northwestern Mutual Recruiting Platform - Railway Deployment"
echo "==============================================================="

# Check if we're in production environment
if [ "$NODE_ENV" = "production" ]; then
    echo "📦 Production deployment detected"
else
    echo "🔧 Development/staging deployment"
fi

# Install dependencies
echo "📦 Installing dependencies..."
cd backend
npm ci --only=production
echo "✅ Backend dependencies installed"

# Run database migrations
echo "🗄️ Running database migrations..."
npm run migrate
echo "✅ Database migrations completed"

# Build frontend if needed (for static hosting)
echo "🎨 Building frontend assets..."
cd ../client
npm ci
npm run build
echo "✅ Frontend build completed"

# Copy frontend build to backend static directory
echo "📁 Copying frontend build to backend..."
rm -rf ../backend/public
mkdir -p ../backend/public
cp -r dist/* ../backend/public/
echo "✅ Frontend assets copied to backend"

# Return to backend directory
cd ../backend

# Verify production configuration
echo "🔍 Verifying production configuration..."

# Check required environment variables
required_vars=(
    "DATABASE_URL"
    "JWT_SECRET"
    "JWT_REFRESH_SECRET"
    "SESSION_SECRET"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Missing required environment variable: $var"
        exit 1
    else
        echo "✅ $var is configured"
    fi
done

# Optional OAuth variables (warn if missing)
oauth_vars=(
    "GOOGLE_CLIENT_ID"
    "GOOGLE_CLIENT_SECRET"
    "MICROSOFT_CLIENT_ID"
    "MICROSOFT_CLIENT_SECRET"
)

for var in "${oauth_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "⚠️  OAuth variable not configured: $var (OAuth login will not work)"
    else
        echo "✅ $var is configured for OAuth"
    fi
done

# Test database connection
echo "🔗 Testing database connection..."
node -e "
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
pool.query('SELECT 1')
  .then(() => { console.log('✅ Database connection successful'); process.exit(0); })
  .catch(err => { console.error('❌ Database connection failed:', err.message); process.exit(1); });
"

echo "🎉 Deployment preparation completed!"
echo "🌐 Starting Northwestern Mutual Recruiting Platform..."
echo "📋 Available routes:"
echo "   - OAuth Login: /api/auth/google, /api/auth/microsoft"
echo "   - Dashboard: /"
echo "   - Health Check: /health"
echo "   - Queue Monitor: /admin/queues"
echo ""

# Start the application
exec npm start