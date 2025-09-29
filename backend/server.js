const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import security middleware
const {
    generalLimiter,
    authLimiter,
    searchLimiter,
    helmetConfig,
    xssProtection,
    sqlInjectionProtection,
    validateInput,
    requestSizeLimit,
    securityLogger,
    corsConfig
} = require('./middleware/security');

// Load environment variables
dotenv.config();

// Disable Redis-backed queues locally to prevent connection crashes
if (!process.env.BULK_DISABLE_REDIS) {
    process.env.BULK_DISABLE_REDIS = 'true';
}

// Import routes
const authRoutes = require('./routes/auth');
const assessmentRoutes = require('./routes/assessment');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/export');
const pipelineRoutes = require('./routes/pipeline');
const candidatesRoutes = require('./routes/candidates');

// Import new AI routes
const aiRoutes = require('./routes/ai.routes');
const emailRoutes = require('./routes/email.routes');
const sourcingRoutes = require('./routes/sourcing');
const outreachRoutes = require('./routes/outreach');

// Import middleware
const errorHandler = require('./middleware/errorHandler');
const { auditMiddleware, auditAuth, auditDataAccess, auditCandidateAction } = require('./middleware/audit');
const { encryptPIIMiddleware, decryptPIIMiddleware } = require('./middleware/pii-encryption');
const {
    compressionMiddleware,
    responseCacheMiddleware,
    queryOptimizationMiddleware,
    memoryOptimizationMiddleware,
    connectionPoolingMiddleware,
    staticAssetMiddleware,
    resourceHintsMiddleware
} = require('./middleware/performance');

// Create Express app
const app = express();
const httpServer = createServer(app);

// Create Socket.IO server
const io = new Server(httpServer, {
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true
    }
});

// Performance middleware stack (applied first for maximum efficiency)
app.use(compressionMiddleware);
app.use(connectionPoolingMiddleware);
app.use(resourceHintsMiddleware);
app.use(staticAssetMiddleware);
app.use(memoryOptimizationMiddleware);
app.use(queryOptimizationMiddleware);

// Security middleware stack
app.use(securityLogger);
app.use(requestSizeLimit);
app.use(helmetConfig);
app.use(cors(corsConfig));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(xssProtection);
app.use(sqlInjectionProtection);
app.use(validateInput);

// Apply rate limiting
app.use('/api/', generalLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/sourcing/', searchLimiter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, '../frontend')));

// PRODUCTION ROUTES - Authentication Required
app.get('/dashboard', (req, res) => {
    // In production, this should redirect to login if not authenticated
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Serve login at root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/login.html'));
});

// Apply audit middleware to all API routes
app.use('/api/', auditMiddleware({ eventCategory: 'API' }));

// Apply PII encryption for Northwestern Mutual compliance - TEMPORARILY DISABLED FOR DEBUGGING
// app.use('/api/', encryptPIIMiddleware);
// app.use('/api/', decryptPIIMiddleware);

// API Routes with specific audit configurations
app.use('/api/auth', auditAuth, authRoutes);
app.use('/api/assessment', auditMiddleware({ eventType: 'ASSESSMENT', riskLevel: 'MEDIUM' }), assessmentRoutes);
app.use('/api/assessments', auditMiddleware({ eventType: 'ASSESSMENT', riskLevel: 'MEDIUM' }), assessmentRoutes);
app.use('/api/dashboard', auditMiddleware({ eventType: 'DASHBOARD', riskLevel: 'LOW' }), dashboardRoutes);
app.use('/api/export', auditMiddleware({ eventType: 'EXPORT', riskLevel: 'HIGH', trackSensitiveData: true }), exportRoutes);
app.use('/api/pipeline', auditMiddleware({ eventType: 'PIPELINE', riskLevel: 'MEDIUM' }), pipelineRoutes);
app.use('/api/candidates', auditMiddleware({ eventType: 'CANDIDATE', riskLevel: 'HIGH', trackSensitiveData: false }), candidatesRoutes); // Temporarily disabled PII encryption

// Add new AI routes with audit
app.use('/api/v3/ai', auditMiddleware({ eventType: 'AI_SERVICE', riskLevel: 'MEDIUM' }), aiRoutes);
app.use('/api/v3/email', auditMiddleware({ eventType: 'EMAIL_SERVICE', riskLevel: 'MEDIUM' }), emailRoutes);
app.use('/api/v3/integrations', auditMiddleware({ eventType: 'INTEGRATIONS', riskLevel: 'LOW' }), require('./routes/integrations.routes'));
// Temporarily disabled to fix startup issue
// app.use('/api/sourcing', auditMiddleware({ eventType: 'SOURCING', riskLevel: 'MEDIUM' }), sourcingRoutes);
app.use('/api/sourcing/outreach', auditMiddleware({ eventType: 'OUTREACH', riskLevel: 'HIGH', trackSensitiveData: true }), outreachRoutes);
app.use('/api/assessment-invitations', auditMiddleware({ eventType: 'ASSESSMENT_INVITATION', riskLevel: 'MEDIUM' }), require('./routes/assessmentInvitations'));

// Employee Assessment Routes
app.use('/api/employee-assessments', auditMiddleware({ eventType: 'EMPLOYEE_ASSESSMENT', riskLevel: 'MEDIUM' }), require('./routes/employeeAssessment'));

// Assessment Questions Route
app.use('/api/assessment-questions', auditMiddleware({ eventType: 'ASSESSMENT_QUESTIONS', riskLevel: 'LOW' }), require('./routes/assessmentQuestions'));

// Job Board API Routes
app.use('/api/v3/job-boards', auditMiddleware({ eventType: 'JOB_BOARDS', riskLevel: 'MEDIUM' }), require('./routes/jobBoards.routes'));

// Northwestern Mutual Trial Routes
const trialRoutes = require('./routes/trial');
app.use('/api/trial', auditMiddleware({ eventType: 'TRIAL', riskLevel: 'MEDIUM' }), trialRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('New WebSocket connection:', socket.id);
    
    socket.on('join-dashboard', (recruiterId) => {
        socket.join(`recruiter-${recruiterId}`);
        console.log(`Recruiter ${recruiterId} joined dashboard`);
    });
    
    socket.on('assessment-update', (data) => {
        // Broadcast to all recruiters watching this candidate
        io.to(`recruiter-${data.recruiterId}`).emit('candidate-progress', data);
    });
    
    socket.on('disconnect', () => {
        console.log('WebSocket disconnected:', socket.id);
    });
});

// Make io accessible to routes
app.set('io', io);

// Initialize AI services on startup
const openAIService = require('./services/openai.service');
const { queues } = require('./services/queue.service');

// Import ML models
const successPredictor = require('./ml/models/successPredictor');
const retentionPredictor = require('./ml/models/retentionPredictor');

async function initializeAI() {
    console.log('🤖 Initializing AI services...');
    
    try {
        await openAIService.initializePinecone();
        await successPredictor.initialize();
        console.log('✅ AI services initialized');
    } catch (error) {
        console.error('❌ AI initialization failed:', error);
    }
}

// Call initialization
initializeAI();

// Add Bull Board for queue monitoring (optional)
const { createBullBoard } = require('@bull-board/api');
const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { ExpressAdapter } = require('@bull-board/express');

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
    queues: Object.values(queues).map(q => new BullAdapter(q)),
    serverAdapter: serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());

// Start servers
const PORT = process.env.PORT || 8000;

httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket server on port ${PORT}`);
    console.log(`Queue monitoring available at /admin/queues`);
});

module.exports = app;
