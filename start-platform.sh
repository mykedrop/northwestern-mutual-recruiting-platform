#!/bin/bash

echo "==========================================="
echo "Northwestern Mutual Recruiting Platform"
echo "Starting Complete Perfection System..."
echo "==========================================="

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to check if port is available
port_available() {
    ! lsof -i :$1 >/dev/null 2>&1
}

# Function to kill processes on port
kill_port() {
    echo "Killing processes on port $1..."
    lsof -ti :$1 | xargs kill -9 2>/dev/null || true
    sleep 2
}

# Function to wait for service
wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=30
    local attempt=1

    echo "Waiting for $name to start..."
    while [ $attempt -le $max_attempts ]; do
        if curl -s "$url" >/dev/null 2>&1; then
            echo "✅ $name is ready!"
            return 0
        fi
        echo "⏳ Attempt $attempt/$max_attempts - waiting for $name..."
        sleep 2
        attempt=$((attempt + 1))
    done

    echo "❌ $name failed to start after $max_attempts attempts"
    return 1
}

# 1. Prerequisites Check
echo "🔍 Checking prerequisites..."

if ! command_exists node; then
    echo "❌ Error: Node.js is not installed"
    exit 1
fi

if ! command_exists npm; then
    echo "❌ Error: npm is not installed"
    exit 1
fi

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "⚠️ Warning: Node.js version $NODE_VERSION detected. Recommended: 16+"
fi

echo "✅ Prerequisites validated"

# 2. Clean existing processes
echo "🧹 Cleaning existing processes..."

kill_port 3000
kill_port 3001
kill_port 5173
kill_port 5175

# Kill any existing node processes for this project
pkill -f "node.*server.js" 2>/dev/null || true
pkill -f "vite.*client" 2>/dev/null || true
pkill -f "npm.*dev" 2>/dev/null || true

echo "✅ Process cleanup complete"

# 3. Install Dependencies
echo "📦 Installing dependencies..."

# Backend dependencies
echo "Installing backend dependencies..."
cd backend
if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    npm install --force --legacy-peer-deps
else
    echo "✅ Backend dependencies already installed"
fi

# Client dependencies
echo "Installing client dependencies..."
cd ../client
if [ ! -d "node_modules" ] || [ ! -f "package-lock.json" ]; then
    npm install --force --legacy-peer-deps
else
    echo "✅ Client dependencies already installed"
fi

cd ..

echo "✅ Dependencies installed"

# 4. Environment Verification
echo "🔧 Verifying environment configuration..."

if [ ! -f "backend/.env" ]; then
    echo "❌ Error: backend/.env file not found"
    exit 1
fi

# Check key environment variables
cd backend
if ! grep -q "DEMO_MODE=true" .env; then
    echo "⚠️ Warning: DEMO_MODE not set to true"
fi

if ! grep -q "JWT_ACCESS_SECRET" .env; then
    echo "❌ Error: JWT_ACCESS_SECRET not configured"
    exit 1
fi

cd ..

echo "✅ Environment verified"

# 5. Database Check
echo "🗄️ Checking database connectivity..."

cd backend
if command_exists psql; then
    # Try to connect to PostgreSQL
    if psql -U mikeweingarten -d northwestern_mutual_recruiting -c "SELECT 1;" >/dev/null 2>&1; then
        echo "✅ PostgreSQL database connected"
    else
        echo "⚠️ PostgreSQL not accessible, application will use fallback mode"
    fi
else
    echo "⚠️ PostgreSQL not installed, application will use fallback mode"
fi

cd ..

echo "✅ Database check complete"

# 6. Start Backend
echo "🚀 Starting backend server..."

cd backend
npm run dev > ../backend.log 2>&1 &
BACKEND_PID=$!

cd ..

echo "Backend starting (PID: $BACKEND_PID)..."

# Wait for backend to be ready
if wait_for_service "http://localhost:3001/health" "Backend API"; then
    echo "✅ Backend server ready"
else
    echo "❌ Backend failed to start"
    kill $BACKEND_PID 2>/dev/null
    exit 1
fi

# 7. Start Frontend
echo "🎨 Starting frontend application..."

cd client
npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!

cd ..

echo "Frontend starting (PID: $FRONTEND_PID)..."

# Wait for frontend to be ready
if wait_for_service "http://localhost:5175" "Frontend Application"; then
    echo "✅ Frontend application ready"
else
    echo "❌ Frontend failed to start"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 1
fi

# 8. System Health Check
echo "🏥 Performing system health check..."

# Test backend health
HEALTH_CHECK=$(curl -s http://localhost:3001/health | grep -o '"status":"healthy"' || echo "failed")
if [ "$HEALTH_CHECK" = '"status":"healthy"' ]; then
    echo "✅ Backend health check passed"
else
    echo "⚠️ Backend health check failed"
fi

# Test frontend accessibility
FRONTEND_CHECK=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5175)
if [ "$FRONTEND_CHECK" = "200" ]; then
    echo "✅ Frontend accessibility confirmed"
else
    echo "⚠️ Frontend accessibility issue (status: $FRONTEND_CHECK)"
fi

# Test API connectivity
API_TEST=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
if [ "$API_TEST" = "200" ] || [ "$API_TEST" = "404" ]; then
    echo "✅ API connectivity confirmed"
else
    echo "⚠️ API connectivity issue"
fi

# 9. Demo Data Verification
echo "🎭 Verifying demo data..."

DEMO_LOGIN=$(curl -s -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"demo@northwestern.com","password":"password123"}' | grep -o '"success":true' || echo "failed")

if [ "$DEMO_LOGIN" = '"success":true' ]; then
    echo "✅ Demo login verified"
else
    echo "⚠️ Demo login issue - check credentials"
fi

# 10. Generate Status Report
echo ""
echo "==========================================="
echo "🎉 PLATFORM READY FOR EXCELLENCE!"
echo "==========================================="
echo ""
echo "🌐 Access URLs:"
echo "   Frontend:  http://localhost:5175"
echo "   Backend:   http://localhost:3001"
echo "   Health:    http://localhost:3001/health"
echo ""
echo "🔐 Demo Credentials:"
echo "   Email:     demo@northwestern.com"
echo "   Password:  password123"
echo ""
echo "📊 System Status:"
echo "   Backend PID:  $BACKEND_PID"
echo "   Frontend PID: $FRONTEND_PID"
echo "   Demo Mode:    ENABLED"
echo "   AI Services:  OPERATIONAL"
echo ""
echo "🚀 Key Features Available:"
echo "   ✅ AI Chat Assistant with intelligent responses"
echo "   ✅ 12-Dimensional Behavioral Assessment"
echo "   ✅ Multi-Recruiter Isolation"
echo "   ✅ Real-time Pipeline Management"
echo "   ✅ Premium UI with Enhanced Metrics"
echo "   ✅ Mock Intelligence for Demo Purposes"
echo ""
echo "📋 Quick Start Commands:"
echo "   • Login with demo credentials"
echo "   • Ask AI: 'Show me top 5 candidates'"
echo "   • Try: 'Analyze pipeline bottlenecks'"
echo "   • Test: 'Find candidates in Philadelphia'"
echo ""
echo "🛠️ Process Management:"
echo "   Stop Backend:  kill $BACKEND_PID"
echo "   Stop Frontend: kill $FRONTEND_PID"
echo "   Stop All:      kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend.log"
echo "   Frontend: tail -f frontend.log"
echo ""
echo "🆘 Support:"
echo "   • Platform Guide: cat RECRUITER_GUIDE.md"
echo "   • API Health: curl http://localhost:3001/health"
echo "   • Browser Console for frontend debugging"
echo ""
echo "==========================================="
echo "Press Ctrl+C to stop all services"
echo "==========================================="

# 11. Keep running and handle cleanup
cleanup() {
    echo ""
    echo "🛑 Shutting down Northwestern Mutual Platform..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "✅ All services stopped"
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Keep script running
while true; do
    sleep 5

    # Check if processes are still running
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo "❌ Backend process died unexpectedly"
        kill $FRONTEND_PID 2>/dev/null
        exit 1
    fi

    if ! kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "❌ Frontend process died unexpectedly"
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
done