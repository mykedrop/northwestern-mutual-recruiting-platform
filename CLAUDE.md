# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Northwestern Mutual Recruiting Platform - a comprehensive behavioral assessment and candidate management platform with AI-powered sourcing, multi-channel outreach, and job board integration capabilities. The platform now includes extensive executive reporting, trial features, and integrated job board APIs (Indeed, ZipRecruiter).

## Architecture

The codebase consists of multiple components with overlapping responsibilities:

### Backend Systems
- **Main Backend** (`/backend/`): Express.js server with comprehensive recruiting platform features
- **Alternative Server** (`/server/`): Similar Express.js setup (appears to be an alternative implementation)
- Both use PostgreSQL, Redis, and Socket.IO for real-time features

### Frontend Systems
- **React Client** (`/client/`): Modern TypeScript/React application using Vite
- **Static Frontend** (`/frontend/`): Traditional HTML/CSS/JS dashboard implementation
- Both provide similar functionality with different tech stacks

### Key Services Architecture

**Assessment System**:
- 12-dimensional behavioral framework assessment
- 27 interactive question types (Likert grids, priority matrices, etc.)
- Real-time scoring and personality mapping (MBTI, Big Five, DISC, Enneagram)

**AI-Powered Sourcing**:
- LinkedIn search and candidate discovery (`backend/services/sourcing/`)
- Signal detection and candidate enrichment
- Google CSE integration with broad query modes
- Job board integrations (Indeed, ZipRecruiter) with unified search
- Bulk candidate operations and automated workflows

**Outreach System**:
- Multi-channel communication (email, SMS, LinkedIn) (`backend/services/outreach/`)
- Template engine for personalized messaging
- Automated scheduling and follow-up campaigns
- Assessment invitation workflows

**Intelligence Layer**:
- OpenAI integration with multi-model AI routing
- Resume parsing and skill extraction
- Behavioral assessment scoring algorithms
- Executive reporting and analytics dashboards
- Trial feature management and A/B testing

**Job Board Integration**:
- Indeed API integration (GraphQL, OAuth 2.0)
- ZipRecruiter API integration (REST, event reporting)
- Unified job posting and search across multiple platforms
- Application tracking and job enhancement features

## Development Commands

### Backend Development
```bash
# Primary backend
cd backend
npm run dev          # Start with nodemon
npm run seed         # Seed database with test data

# Alternative server
cd server
npm run dev          # Start with nodemon
npm test            # Run Jest tests
npm run test:coverage # Run tests with coverage
```

### Frontend Development
```bash
# React client
cd client
npm run dev         # Start Vite dev server (port 5175)
npm run build       # Build for production
npm run test        # Run Vitest tests
npm run lint        # ESLint code checking

# Static frontend - serve files directly or use any HTTP server
```

### Database Management
```bash
cd backend
npm run setup-db    # Initialize database schema
npm run seed        # Populate with test data

# Manual database operations
psql -U postgres -d northwestern_mutual_recruiting -f backend/utils/database-setup.sql
```

### Docker Development
```bash
docker-compose up   # Start full stack (client, server, db, redis)
```

## Environment Setup

### Required Environment Files
- `backend/.env` - Main backend configuration
- `server/.env` - Alternative server configuration
- Client uses Vite environment variables (`VITE_API_URL`, `VITE_WS_URL`)

### Key Environment Variables
```bash
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=northwestern_mutual_recruiting

# JWT Authentication
JWT_SECRET=<change-in-production>
JWT_REFRESH_SECRET=<change-in-production>

# API Integrations
OPENAI_API_KEY=<your-key>
GOOGLE_CSE_API_KEY=<your-key>
SENDGRID_API_KEY=<your-key>

# Redis (for queues and caching)
REDIS_URL=redis://localhost:6379
```

## Key Integrations

### OpenAI Integration
- Candidate assessment analysis
- Resume parsing and skill extraction
- Behavioral scoring recommendations

### Google Custom Search Engine
- Broad candidate discovery mode
- Site-restricted and open web searches
- Pagination handling for better results

### LinkedIn Services
- Automated profile searches
- Connection requests and messaging
- Profile data enrichment

### Job Board APIs
- **Indeed**: GraphQL API with OAuth 2.0, job posting, search, application tracking
- **ZipRecruiter**: REST API with basic auth, job posting, search, event reporting
- Unified integration service for multi-source operations

### Multi-channel Outreach
- Email campaigns (SendGrid)
- SMS messaging (Twilio)
- LinkedIn messaging automation
- Assessment invitation system

## Database Schema

Key tables include:
- `candidates` - Core candidate information
- `assessments` - Behavioral assessment data
- `assessment_responses` - Individual question responses
- `outreach_campaigns` - Campaign management
- `sourcing_results` - Search and discovery results
- `assessment_invitations` - Assessment invitation tracking
- `job_postings` - Job postings across multiple boards
- `job_board_configs` - API configurations per user
- `external_job_applications` - Applications from external sources
- `integration_configs` - Third-party service configurations

Migration files in `backend/migrations/` contain schema definitions.

## Authentication System

JWT-based authentication with refresh tokens:
- Login endpoint: `POST /api/auth/login`
- Token refresh: `POST /api/auth/refresh`
- Demo account: `demo@northwestern.com` / `password123`

## Testing

### Backend Testing
```bash
cd server
npm test              # Jest test suite
npm run test:watch    # Watch mode
```

### Frontend Testing
```bash
cd client
npm test              # Vitest tests
npm run test:ui       # Test UI interface
```

## API Endpoints

### Core Platform APIs
- `/api/auth/*` - Authentication and user management
- `/api/candidates/*` - Candidate CRUD operations
- `/api/assessments/*` - Assessment management and scoring
- `/api/sourcing/*` - Search and discovery operations
- `/api/outreach/*` - Communication campaigns
- `/api/analytics/*` - Reporting and metrics

### New Feature APIs
- `/api/v3/job-boards/*` - Job board integrations (Indeed, ZipRecruiter)
- `/api/integrations/*` - Third-party service configurations
- `/api/executive/*` - Executive reporting and dashboards
- `/api/trial/*` - Trial feature management
- `/api/ai/*` - AI-powered chat and analysis
- `/api/email/*` - Email template and campaign management

### Assessment Invitation System
- `/api/assessment-invitations/*` - Invitation lifecycle management
- Automated email delivery with customizable templates
- Progress tracking and completion notifications

## Common Development Patterns

### API Client Usage
Both frontends use centralized API clients for backend communication with JWT token handling.

### Real-time Updates
Socket.IO implementation for live assessment progress, completion notifications, and dashboard updates.

### Queue System
Bull queues (Redis-backed) for background processing of sourcing, outreach, and analysis tasks. Can be disabled locally via `BULK_DISABLE_REDIS=true`.

### Error Handling
Centralized error handling middleware with structured error responses and security filtering.

### Multi-Model AI Integration
Revolutionary AI Router with support for multiple OpenAI models and intelligent request routing.

## Production Considerations

- Update all JWT secrets and API keys
- Configure proper CORS origins
- Set up SSL/TLS certificates
- Configure Redis for production queues
- Set up monitoring and logging
- Database backup strategies

## CRITICAL VERIFICATION RULES - NEVER VIOLATE

### Pre-Development Verification (MANDATORY)
1. **Backend Health Check**: Always run `curl http://localhost:3001/health` and check backend logs before ANY demo work
2. **Frontend Connectivity**: Verify React client is running on port 5175 and can reach backend
3. **Database Schema Verification**: Query actual table schema before writing SQL - never assume column names exist
4. **Critical Endpoint Testing**: Test AI chat, job board integrations, assessment invitations, and core features manually before automation
5. **Error Log Analysis**: Read complete backend error logs and fix ALL errors before proceeding
6. **Service Health**: Verify OpenAI, Pinecone, and job board API connections are working

### Demo Creation Protocol (MANDATORY)
1. **No Assumptions**: Never assume anything works - verify every step
2. **Progressive Testing**: Test individual components before full automation
3. **Error-Free Requirement**: Backend must show zero errors before recording any demo
4. **Reality Verification Loop**: After every action, verify it actually worked

### Database Work Rules (MANDATORY)
1. **Schema First**: Always query database schema before referencing columns
2. **Column Verification**: Use `\d table_name` in psql to verify column names exist
3. **Test Queries**: Run SQL queries manually before embedding in code
4. **Error Handling**: Fix database errors immediately - never ignore them

### Security Middleware Rules (MANDATORY)
1. **Exception Testing**: Test all user-facing endpoints after security changes
2. **AI Chat Verification**: Ensure AI endpoints work with realistic user queries
3. **False Positive Prevention**: Add necessary exceptions for legitimate use cases
4. **End-to-End Testing**: Test full user workflows after security modifications

### Quality Control Protocol (MANDATORY)
1. **Five-Phase Verification**: Follow systematic verification before any delivery
2. **Screenshot Evidence**: Capture proof that features actually work
3. **Video Verification**: Watch complete demo videos before delivery
4. **Zero Tolerance**: Never deliver broken features - fix or document limitations

### Escalation Rules (MANDATORY)
1. **Three-Strike Rule**: If same error occurs 3 times, stop and redesign approach
2. **Time Boxing**: If any single issue takes >30 minutes, try different approach
3. **Documentation**: Document every approach attempted and what worked
4. **Success Patterns**: Record and reuse successful patterns

**ACCOUNTABILITY**: Every violation of these rules results in immediate process reset and failure analysis update.