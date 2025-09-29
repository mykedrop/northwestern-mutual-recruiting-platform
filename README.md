# Northwestern Mutual Recruiting Platform

A comprehensive behavioral assessment and candidate management platform built for Northwestern Mutual's recruiting team.

## 🚀 Features

### Phase 1: Assessment Engine (Complete)
- **12-Dimensional Behavioral Framework**: Comprehensive personality and behavioral assessment
- **27 Interactive Questions**: Multiple question types including Likert grids, priority matrices, and more
- **Real-time Scoring**: Instant dimensional score calculations
- **Personality Framework Mapping**: MBTI, Big Five, DISC, and Enneagram integration

### Phase 2: Backend & Dashboard (Complete)
- **Full Backend Infrastructure**: Express.js server with PostgreSQL database
- **Authentication System**: JWT-based auth with refresh tokens
- **Recruiter Dashboard**: Comprehensive candidate management interface
- **Real-time Updates**: WebSocket integration for live progress tracking
- **Analytics & Insights**: Advanced reporting and candidate comparison
- **Export Capabilities**: PDF and CSV export functionality

## 🏗️ Architecture

```
northwestern-mutual-assessment/
├── frontend/                 # Assessment interface & dashboard
│   ├── assessment.html      # Main assessment page
│   ├── dashboard.html       # Recruiter dashboard
│   ├── login.html          # Authentication page
│   ├── assets/             # CSS, JS, and assets
│   └── api-client.js       # API communication layer
├── backend/                 # Server infrastructure
│   ├── server.js           # Main Express server
│   ├── config/             # Database and auth configuration
│   ├── controllers/        # API endpoint handlers
│   ├── services/           # Business logic services
│   ├── middleware/         # Authentication and validation
│   ├── routes/             # API route definitions
│   └── utils/              # Database seeding and utilities
└── data/                   # Question bank and assessment data
    └── question-bank.json  # 27-question assessment bank
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js 16+ and npm
- PostgreSQL 12+
- Redis (optional, for caching)

### 1. Clone and Install Dependencies
```bash
git clone <repository-url>
cd northwestern-mutual-assessment

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies (if any)
cd ../frontend
npm install  # if package.json exists
```

### 2. Database Setup
```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE northwestern_mutual_recruiting;"

# Run database setup
psql -U postgres -d northwestern_mutual_recruiting -f backend/utils/database-setup.sql

# Seed with test data
cd backend
node utils/seed-data.js
```

### 3. Environment Configuration
Create `backend/.env` file:
```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=northwestern_mutual_recruiting
DB_USER=postgres
DB_PASSWORD=your_password_here

# JWT
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_REFRESH_SECRET=your_refresh_token_secret_change_this
JWT_EXPIRE=1h
JWT_REFRESH_EXPIRE=7d

# Server
PORT=8000
SOCKET_PORT=8001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### 4. Start the Platform
```bash
# Start backend server
cd backend
npm run dev

# Start frontend (if using a dev server)
cd ../frontend
# Serve files using your preferred method
```

## 🔐 Authentication

### Demo Account
- **Email**: `demo@northwestern.com`
- **Password**: `password123`

### Login Flow
1. Navigate to `/login.html`
2. Enter credentials
3. Redirected to dashboard upon successful authentication
4. JWT tokens stored in localStorage for API requests

## 📊 Assessment System

### 12 Behavioral Dimensions
1. **Cognitive Flexibility** - Adaptability and creative thinking
2. **Emotional Regulation** - Stress management and composure
3. **Social Calibration** - Interpersonal awareness and adjustment
4. **Achievement Drive** - Goal orientation and persistence
5. **Learning Orientation** - Growth mindset and curiosity
6. **Risk Tolerance** - Comfort with uncertainty and change
7. **Relationship Building** - Networking and connection skills
8. **Ethical Reasoning** - Integrity and moral decision-making
9. **Influence Style** - Leadership and persuasion approaches
10. **Systems Thinking** - Analytical and strategic perspective
11. **Self Management** - Organization and discipline
12. **Collaborative Intelligence** - Teamwork and cooperation

### Question Types
- **Likert Grid**: 5-point scale responses
- **Sliding Spectrum**: Position-based preferences
- **Priority Matrix**: Eisenhower-style prioritization
- **Speed Ranking**: Quick preference ordering
- **Word Cloud**: Multiple choice selections
- **Emoji Reaction**: Emotional response capture
- **Percentage Allocator**: Resource distribution
- **Two-Pile Sort**: Energizing vs. draining activities

## 🎯 Dashboard Features

### Overview
- Real-time statistics and metrics
- Recent candidate activity
- Notification center

### Candidates
- Complete candidate listing
- Search and filtering
- Status tracking
- Progress monitoring

### Analytics
- Dimensional score averages
- Top performer identification
- Framework distribution charts
- Trend analysis

### Comparison
- Multi-candidate analysis
- Strength identification
- Difference highlighting
- Team composition insights

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Token refresh

### Assessment
- `POST /api/assessment/start` - Begin assessment
- `POST /api/assessment/response` - Save response
- `POST /api/assessment/complete` - Finish assessment
- `GET /api/assessment/results/:id` - Get results

### Dashboard
- `GET /api/dashboard/overview` - Dashboard summary
- `GET /api/dashboard/candidates` - Candidate listing
- `GET /api/dashboard/candidate/:id` - Candidate details
- `POST /api/dashboard/compare` - Compare candidates
- `GET /api/dashboard/analytics` - Analytics data

### Export
- `POST /api/export/pdf` - Generate PDF report
- `POST /api/export/csv` - Generate CSV export
- `GET /api/export/status/:id` - Check export status

## 📈 Real-time Features

### WebSocket Events
- **candidate-progress**: Live assessment progress updates
- **assessment-completed**: Instant completion notifications
- **join-dashboard**: Recruiter dashboard subscription

### Live Updates
- Assessment progress tracking
- Completion notifications
- Real-time candidate status changes

## 🚀 Usage Examples

### Starting an Assessment
```javascript
// Frontend integration
const response = await fetch('/api/assessment/start', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ candidateId: 'uuid' })
});
```

### Recording Responses
```javascript
await fetch('/api/assessment/response', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
        assessmentId: 'uuid',
        questionId: 'q001',
        questionType: 'likert_grid',
        responseData: { responses: { adaptability: 4 } }
    })
});
```

### Dashboard Integration
```javascript
// Load candidate data
const candidates = await apiClient.get('/dashboard/candidates');

// Compare candidates
const comparison = await apiClient.post('/dashboard/compare', {
    candidateIds: ['uuid1', 'uuid2']
});
```

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev  # Start with nodemon
```

### Database Management
```bash
# Reset database
psql -U postgres -d northwestern_mutual_recruiting -f utils/database-setup.sql

# Seed data
node utils/seed-data.js
```

### Testing
```bash
# Health check
curl http://localhost:8000/health

# API test
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/dashboard/overview
```

## 📋 Production Checklist

- [ ] Update JWT secrets in `.env`
- [ ] Configure production database credentials
- [ ] Set up SSL/TLS certificates
- [ ] Configure CORS for production domains
- [ ] Set up monitoring and logging
- [ ] Configure backup strategies
- [ ] Set up CI/CD pipeline
- [ ] Performance testing and optimization

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is proprietary software developed for Northwestern Mutual.

## 🆘 Support

For technical support or questions:
- Check the documentation above
- Review the code comments
- Contact the development team

---

**Northwestern Mutual Recruiting Platform** - Built for excellence in talent acquisition and behavioral assessment.
