const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const { createServer } = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');

// Load environment variables
dotenv.config();

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

// Import middleware
const errorHandler = require('./middleware/errorHandler');

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

// Basic middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/assessment', assessmentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/pipeline', pipelineRoutes);
app.use('/api/candidates', candidatesRoutes);

// Add new AI routes
app.use('/api/v3/ai', aiRoutes);
app.use('/api/v3/email', emailRoutes);

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

    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`Socket ${socket.id} joined room ${room}`);
    });

    socket.on('leave-room', (room) => {
        socket.leave(room);
        console.log(`Socket ${socket.id} left room ${room}`);
    });
    
    socket.on('assessment-update', (data) => {
        // Broadcast to all recruiters watching this candidate
        io.to(`recruiter-${data.recruiterId}`).emit('candidate-progress', data);
    });
    
    socket.on('disconnect', () => {
        console.log('WebSocket disconnected:', socket.id);
    });
});

// Emit events helper function
const emitUpdate = (eventType, data) => {
    io.emit(eventType, data);
};

// Make emitUpdate accessible to routes
app.set('emitUpdate', emitUpdate);

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
