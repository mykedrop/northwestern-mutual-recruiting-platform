// Performance Optimization Middleware for Northwestern Mutual Platform
// Enterprise-grade performance enhancements for Fortune 100 deployment

const compression = require('compression');
const helmet = require('helmet');

class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.compressionLevel = 6; // Optimal balance between speed and compression
        this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
        this.performanceMetrics = {
            requestCount: 0,
            averageResponseTime: 0,
            slowQueries: [],
            cacheHitRate: 0,
            memoryUsage: process.memoryUsage()
        };

        // Start performance monitoring
        this.startPerformanceMonitoring();
        console.log('🚀 Performance Optimizer initialized');
    }

    // Compression middleware with intelligent settings
    getCompressionMiddleware() {
        return compression({
            filter: (req, res) => {
                // Don't compress responses with this request header
                if (req.headers['x-no-compression']) {
                    return false;
                }

                // Fallback to standard filter function
                return compression.filter(req, res);
            },
            level: this.compressionLevel,
            threshold: 1024, // Only compress responses larger than 1KB
            windowBits: 15,
            memLevel: 8
        });
    }

    // Response caching middleware
    responseCacheMiddleware(duration = 300000) { // 5 minutes default
        return (req, res, next) => {
            // Only cache GET requests
            if (req.method !== 'GET') {
                return next();
            }

            // Skip caching for authenticated requests with sensitive data
            if (req.headers.authorization && this.isSensitiveRoute(req.path)) {
                return next();
            }

            const cacheKey = this.generateCacheKey(req);
            const cachedResponse = this.cache.get(cacheKey);

            if (cachedResponse && Date.now() - cachedResponse.timestamp < duration) {
                res.set(cachedResponse.headers);
                res.set('X-Cache', 'HIT');
                this.updateCacheMetrics(true);
                return res.status(cachedResponse.status).send(cachedResponse.body);
            }

            // Override res.send to cache response
            const originalSend = res.send;
            const originalJson = res.json;

            const cacheResponse = (body) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    this.cache.set(cacheKey, {
                        status: res.statusCode,
                        headers: { ...res.getHeaders() },
                        body,
                        timestamp: Date.now()
                    });

                    // Clean up expired cache entries
                    this.cleanupExpiredCache();
                }
                this.updateCacheMetrics(false);
                res.set('X-Cache', 'MISS');
            };

            res.send = function(body) {
                cacheResponse(body);
                return originalSend.call(this, body);
            };

            res.json = function(obj) {
                cacheResponse(obj);
                return originalJson.call(this, obj);
            };

            next();
        };
    }

    // Database query optimization middleware
    queryOptimizationMiddleware() {
        return (req, res, next) => {
            const startTime = Date.now();

            // Override database query methods to track performance
            if (req.db && req.db.query) {
                const originalQuery = req.db.query;
                req.db.query = async (...args) => {
                    const queryStart = Date.now();
                    try {
                        const result = await originalQuery.apply(req.db, args);
                        const queryTime = Date.now() - queryStart;

                        // Log slow queries
                        if (queryTime > 1000) { // Queries taking more than 1 second
                            this.logSlowQuery(args[0], queryTime);
                        }

                        return result;
                    } catch (error) {
                        console.error('Database query error:', error);
                        throw error;
                    }
                };
            }

            res.on('finish', () => {
                const responseTime = Date.now() - startTime;
                this.updatePerformanceMetrics(responseTime);

                // Log slow requests
                if (responseTime > 3000) { // Requests taking more than 3 seconds
                    console.warn(`🐌 Slow request: ${req.method} ${req.path} - ${responseTime}ms`);
                }
            });

            next();
        };
    }

    // Memory optimization middleware
    memoryOptimizationMiddleware() {
        return (req, res, next) => {
            // Limit request payload size
            if (req.headers['content-length'] && parseInt(req.headers['content-length']) > 50 * 1024 * 1024) { // 50MB
                return res.status(413).json({ error: 'Payload too large' });
            }

            // Add memory cleanup after response
            res.on('finish', () => {
                // Force garbage collection if available and memory usage is high
                const memUsage = process.memoryUsage();
                if (global.gc && memUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
                    global.gc();
                }
            });

            next();
        };
    }

    // Connection pooling optimization
    connectionPoolingMiddleware() {
        return (req, res, next) => {
            // Set connection keep-alive headers
            res.set({
                'Connection': 'keep-alive',
                'Keep-Alive': 'timeout=5, max=1000'
            });

            next();
        };
    }

    // Request batching middleware
    requestBatchingMiddleware() {
        const batchRequests = new Map();

        return (req, res, next) => {
            // Only batch specific API endpoints
            if (!this.isBatchableRequest(req)) {
                return next();
            }

            const batchKey = this.generateBatchKey(req);

            if (!batchRequests.has(batchKey)) {
                batchRequests.set(batchKey, {
                    requests: [],
                    timer: null
                });
            }

            const batch = batchRequests.get(batchKey);
            batch.requests.push({ req, res });

            // Clear existing timer
            if (batch.timer) {
                clearTimeout(batch.timer);
            }

            // Set new timer to process batch
            batch.timer = setTimeout(() => {
                this.processBatch(batchKey, batch.requests);
                batchRequests.delete(batchKey);
            }, 50); // 50ms batch window

            // If batch is full, process immediately
            if (batch.requests.length >= 10) {
                clearTimeout(batch.timer);
                this.processBatch(batchKey, batch.requests);
                batchRequests.delete(batchKey);
            }
        };
    }

    // CDN and static asset optimization
    staticAssetMiddleware() {
        return (req, res, next) => {
            // Set cache headers for static assets
            if (this.isStaticAsset(req.path)) {
                const maxAge = this.getAssetCacheMaxAge(req.path);
                res.set({
                    'Cache-Control': `public, max-age=${maxAge}`,
                    'ETag': this.generateETag(req.path),
                    'Vary': 'Accept-Encoding'
                });

                // Handle conditional requests
                if (req.headers['if-none-match'] && req.headers['if-none-match'] === this.generateETag(req.path)) {
                    return res.status(304).end();
                }
            }

            next();
        };
    }

    // Resource hints middleware
    resourceHintsMiddleware() {
        return (req, res, next) => {
            if (req.path === '/' || req.path.includes('.html')) {
                res.set({
                    'Link': [
                        '</css/design-system.css>; rel=preload; as=style',
                        '</js/state-management-enhanced.js>; rel=preload; as=script',
                        '</api/dashboard/stats>; rel=prefetch',
                        'https://fonts.googleapis.com; rel=dns-prefetch'
                    ].join(', ')
                });
            }
            next();
        };
    }

    // Utility methods
    generateCacheKey(req) {
        return `${req.method}:${req.path}:${JSON.stringify(req.query)}`;
    }

    generateBatchKey(req) {
        return `${req.baseUrl}${req.route?.path || req.path}`;
    }

    generateETag(filePath) {
        // Simple ETag generation - in production, use file hash
        return `"${Buffer.from(filePath).toString('base64')}"`;
    }

    isSensitiveRoute(path) {
        const sensitiveRoutes = ['/api/auth', '/api/candidates', '/api/assessments', '/api/export'];
        return sensitiveRoutes.some(route => path.startsWith(route));
    }

    isBatchableRequest(req) {
        const batchableRoutes = ['/api/candidates/search', '/api/dashboard/stats'];
        return batchableRoutes.some(route => req.path.includes(route));
    }

    isStaticAsset(path) {
        const staticExtensions = ['.css', '.js', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2'];
        return staticExtensions.some(ext => path.endsWith(ext));
    }

    getAssetCacheMaxAge(path) {
        if (path.includes('design-system') || path.includes('nm-')) {
            return 86400; // 1 day for design system assets
        }
        if (path.endsWith('.css') || path.endsWith('.js')) {
            return 3600; // 1 hour for other CSS/JS
        }
        if (this.isStaticAsset(path)) {
            return 604800; // 1 week for images and fonts
        }
        return 300; // 5 minutes default
    }

    async processBatch(batchKey, requests) {
        // Implement batch processing logic
        console.log(`📦 Processing batch of ${requests.length} requests for ${batchKey}`);

        // For now, process individually - implement actual batching based on endpoint
        requests.forEach(({ req, res, next }) => {
            // Process each request
            if (next) next();
        });
    }

    cleanupExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache.entries()) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    updateCacheMetrics(hit) {
        this.performanceMetrics.requestCount++;
        if (hit) {
            this.performanceMetrics.cacheHitRate =
                (this.performanceMetrics.cacheHitRate * (this.performanceMetrics.requestCount - 1) + 1) /
                this.performanceMetrics.requestCount;
        } else {
            this.performanceMetrics.cacheHitRate =
                (this.performanceMetrics.cacheHitRate * (this.performanceMetrics.requestCount - 1)) /
                this.performanceMetrics.requestCount;
        }
    }

    updatePerformanceMetrics(responseTime) {
        this.performanceMetrics.requestCount++;
        this.performanceMetrics.averageResponseTime =
            (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.requestCount - 1) + responseTime) /
            this.performanceMetrics.requestCount;
    }

    logSlowQuery(query, duration) {
        this.performanceMetrics.slowQueries.push({
            query: typeof query === 'string' ? query.substring(0, 100) : 'Complex Query',
            duration,
            timestamp: new Date().toISOString()
        });

        // Keep only last 100 slow queries
        if (this.performanceMetrics.slowQueries.length > 100) {
            this.performanceMetrics.slowQueries = this.performanceMetrics.slowQueries.slice(-100);
        }
    }

    startPerformanceMonitoring() {
        setInterval(() => {
            this.performanceMetrics.memoryUsage = process.memoryUsage();

            // Log performance metrics every 5 minutes
            console.log('📊 Performance Metrics:', {
                requests: this.performanceMetrics.requestCount,
                avgResponseTime: `${this.performanceMetrics.averageResponseTime.toFixed(2)}ms`,
                cacheHitRate: `${(this.performanceMetrics.cacheHitRate * 100).toFixed(2)}%`,
                memoryUsage: `${(this.performanceMetrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`,
                cacheSize: this.cache.size
            });
        }, 5 * 60 * 1000); // 5 minutes
    }

    getPerformanceMetrics() {
        return this.performanceMetrics;
    }

    clearCache() {
        this.cache.clear();
        console.log('🗑️ Performance cache cleared');
    }
}

const performanceOptimizer = new PerformanceOptimizer();

module.exports = {
    performanceOptimizer,
    compressionMiddleware: performanceOptimizer.getCompressionMiddleware(),
    responseCacheMiddleware: (duration) => performanceOptimizer.responseCacheMiddleware(duration),
    queryOptimizationMiddleware: performanceOptimizer.queryOptimizationMiddleware(),
    memoryOptimizationMiddleware: performanceOptimizer.memoryOptimizationMiddleware(),
    connectionPoolingMiddleware: performanceOptimizer.connectionPoolingMiddleware(),
    requestBatchingMiddleware: performanceOptimizer.requestBatchingMiddleware(),
    staticAssetMiddleware: performanceOptimizer.staticAssetMiddleware(),
    resourceHintsMiddleware: performanceOptimizer.resourceHintsMiddleware()
};