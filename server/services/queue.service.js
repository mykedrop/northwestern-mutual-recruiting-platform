const Bull = require('bull');
const Redis = require('ioredis');

// Create Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Create queues for different job types
const queues = {
    emailQueue: new Bull('email', { redis }),
    embeddingQueue: new Bull('embedding', { redis }),
    predictionQueue: new Bull('prediction', { redis }),
    schedulingQueue: new Bull('scheduling', { redis }),
    scraperQueue: new Bull('scraper', { redis })
};

// Email Queue Processor
queues.emailQueue.process(async (job) => {
    const { type, data } = job.data;
    
    switch (type) {
        case 'send_campaign':
            // Process email campaign
            break;
        case 'send_single':
            // Send single email
            break;
        case 'send_reminder':
            // Send reminder email
            break;
    }
    
    return { success: true };
});

// Embedding Queue Processor
queues.embeddingQueue.process(async (job) => {
    const { candidateId, text } = job.data;
    const openAIService = require('./openai.service');
    
    const embedding = await openAIService.generateEmbedding(text);
    await openAIService.storeCandidateEmbedding(candidateId, embedding, {
        type: 'profile',
        generated: new Date()
    });
    
    return { candidateId, embedded: true };
});

// Prediction Queue Processor
queues.predictionQueue.process(async (job) => {
    const { candidateId, type } = job.data;
    const successPredictor = require('../ml/models/successPredictor');
    const retentionPredictor = require('../ml/models/retentionPredictor');
    
    let result;
    
    switch (type) {
        case 'success':
            result = await successPredictor.predict(job.data.candidateData);
            break;
        case 'retention':
            result = await retentionPredictor.predict(job.data.candidateData);
            break;
    }
    
    return result;
});

// Add job helper functions
const addEmailJob = (data) => {
    return queues.emailQueue.add(data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 }
    });
};

const addEmbeddingJob = (data) => {
    return queues.embeddingQueue.add(data, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
    });
};

const addPredictionJob = (data) => {
    return queues.predictionQueue.add(data, {
        attempts: 2,
        backoff: { type: 'fixed', delay: 3000 }
    });
};

module.exports = {
    queues,
    addEmailJob,
    addEmbeddingJob,
    addPredictionJob
};

