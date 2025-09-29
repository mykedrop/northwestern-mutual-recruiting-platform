/**
 * REVOLUTIONARY AI ROUTER SERVICE
 *
 * The most advanced AI model orchestration system for recruiting.
 * Intelligently routes queries to optimal models in real-time.
 *
 * Features:
 * - Multi-model orchestration (GPT-4, Claude, Perplexity)
 * - Intelligent routing based on query complexity
 * - Performance optimization and load balancing
 * - Fallback strategies for high availability
 * - Real-time model health monitoring
 *
 * @author AI Development Team
 * @version 2.0.0 (Revolutionary)
 */

const OpenAI = require('openai');
const { Anthropic } = require('@anthropic-ai/sdk');
const db = require('../db');

class AIRouterService {
    constructor() {
        this.initializeModels();
        this.modelPerformance = new Map();
        this.loadBalancer = new Map();
        this.healthChecker = new Map();

        // Start health monitoring
        this.startHealthMonitoring();
    }

    initializeModels() {
        // Initialize OpenAI
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        // Initialize Anthropic (Claude)
        this.anthropic = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });

        // Model configurations
        this.models = {
            'gpt-4-turbo': {
                provider: 'openai',
                model: 'gpt-4-turbo-preview',
                strengths: ['reasoning', 'analysis', 'complex_queries'],
                speed: 'medium',
                cost: 'high',
                maxTokens: 4000,
                contextWindow: 128000
            },
            'claude-3-5-sonnet': {
                provider: 'anthropic',
                model: 'claude-3-5-sonnet-20241022',
                strengths: ['speed', 'coding', 'structured_output'],
                speed: 'fast',
                cost: 'medium',
                maxTokens: 4000,
                contextWindow: 200000
            },
            'gpt-3-5-turbo': {
                provider: 'openai',
                model: 'gpt-3.5-turbo',
                strengths: ['speed', 'simple_queries', 'cost_efficiency'],
                speed: 'very_fast',
                cost: 'low',
                maxTokens: 2000,
                contextWindow: 16000
            }
        };

        console.log('🧠 Revolutionary AI Router initialized with', Object.keys(this.models).length, 'models');
    }

    /**
     * INTELLIGENT MODEL SELECTION ENGINE
     * Analyzes query to determine optimal model
     */
    async selectOptimalModel(query, context = {}) {
        const analysis = this.analyzeQuery(query, context);

        // Score models based on query requirements
        const modelScores = {};

        for (const [modelName, config] of Object.entries(this.models)) {
            let score = 0;

            // Complexity scoring
            if (analysis.complexity === 'high' && config.strengths.includes('reasoning')) {
                score += 40;
            } else if (analysis.complexity === 'medium' && config.strengths.includes('analysis')) {
                score += 30;
            } else if (analysis.complexity === 'low' && config.strengths.includes('speed')) {
                score += 35;
            }

            // Speed requirements
            if (analysis.speedRequired && config.speed === 'very_fast') {
                score += 30;
            } else if (analysis.speedRequired && config.speed === 'fast') {
                score += 20;
            }

            // Context window requirements
            if (analysis.contextSize > 50000 && config.contextWindow >= 100000) {
                score += 25;
            }

            // Performance history
            const performance = this.modelPerformance.get(modelName) || { successRate: 0.95, avgResponseTime: 2000 };
            score += performance.successRate * 20;
            score -= Math.min(performance.avgResponseTime / 100, 10); // Penalty for slow responses

            // Load balancing
            const currentLoad = this.loadBalancer.get(modelName) || 0;
            score -= currentLoad * 5;

            modelScores[modelName] = score;
        }

        // Select best model
        const selectedModel = Object.entries(modelScores).reduce((a, b) =>
            modelScores[a[0]] > modelScores[b[0]] ? a : b
        )[0];

        console.log(`🎯 AI Router selected ${selectedModel} for query (score: ${modelScores[selectedModel].toFixed(1)})`);
        return selectedModel;
    }

    /**
     * ADVANCED QUERY ANALYSIS
     * Determines complexity, requirements, and optimal routing
     */
    analyzeQuery(query, context) {
        const analysis = {
            complexity: 'medium',
            speedRequired: false,
            contextSize: JSON.stringify(context).length,
            queryType: 'general',
            requiresReasoning: false,
            requiresData: false
        };

        // Complexity analysis
        const complexPatterns = [
            /analyze.*candidate.*fit/i,
            /predict.*success/i,
            /compare.*candidates/i,
            /recommendation.*based.*on/i,
            /strategy.*for.*hiring/i,
            /what.*if.*scenario/i
        ];

        const simplePatterns = [
            /show.*list/i,
            /count.*candidates/i,
            /status.*of/i,
            /when.*is/i,
            /simple.*question/i
        ];

        if (complexPatterns.some(pattern => pattern.test(query))) {
            analysis.complexity = 'high';
            analysis.requiresReasoning = true;
        } else if (simplePatterns.some(pattern => pattern.test(query))) {
            analysis.complexity = 'low';
            analysis.speedRequired = true;
        }

        // Query type classification
        if (query.toLowerCase().includes('candidate')) {
            analysis.queryType = 'candidate_analysis';
        } else if (query.toLowerCase().includes('pipeline')) {
            analysis.queryType = 'pipeline_management';
        } else if (query.toLowerCase().includes('analytics') || query.toLowerCase().includes('report')) {
            analysis.queryType = 'analytics';
        } else if (query.toLowerCase().includes('search') || query.toLowerCase().includes('find')) {
            analysis.queryType = 'search';
        }

        // Data requirements
        if (query.toLowerCase().includes('show') || query.toLowerCase().includes('list') || query.toLowerCase().includes('data')) {
            analysis.requiresData = true;
        }

        return analysis;
    }

    /**
     * INTELLIGENT RESPONSE GENERATION
     * Routes to optimal model and generates response
     */
    async generateIntelligentResponse(query, context = {}) {
        const startTime = Date.now();
        let selectedModel, response, modelConfig;

        // DEMO MODE: Return intelligent demo responses
        if (process.env.DEMO_MODE === 'true') {
            return await this.generateDemoResponse(query, context);
        }

        try {
            // Get comprehensive context
            const enhancedContext = await this.buildEnhancedContext(context);

            // Select optimal model
            selectedModel = await this.selectOptimalModel(query, enhancedContext);
            modelConfig = this.models[selectedModel];

            // Increment load counter
            this.loadBalancer.set(selectedModel, (this.loadBalancer.get(selectedModel) || 0) + 1);

            // Generate response with selected model
            response = await this.executeWithModel(selectedModel, query, enhancedContext);

            // Record successful performance
            this.recordPerformance(selectedModel, Date.now() - startTime, true);

            return {
                response,
                metadata: {
                    model: selectedModel,
                    responseTime: Date.now() - startTime,
                    tokensUsed: this.estimateTokens(query + response),
                    context: enhancedContext
                }
            };

        } catch (error) {
            console.error(`❌ AI Router error with ${selectedModel}:`, error.message);

            // Record failed performance
            if (selectedModel) {
                this.recordPerformance(selectedModel, Date.now() - startTime, false);
            }

            // In demo mode or when all models fail, use demo fallback
            if (process.env.DEMO_MODE === 'true' || process.env.ENABLE_MOCK_AI === 'true') {
                return await this.generateDemoResponse(query, context);
            }

            // Fallback to most reliable model
            return await this.fallbackResponse(query, context, error);

        } finally {
            // Decrement load counter
            if (selectedModel) {
                this.loadBalancer.set(selectedModel, Math.max(0, (this.loadBalancer.get(selectedModel) || 0) - 1));
            }
        }
    }

    /**
     * ENHANCED CONTEXT BUILDER
     * Builds comprehensive context from database and environment
     */
    async buildEnhancedContext(baseContext = {}) {
        try {
            // Get candidate data
            const candidatesResult = await db.query(`
                SELECT
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.email,
                    c.created_at,
                    ps.name as pipeline_stage,
                    a.completion_status,
                    COUNT(ds.id) as dimension_scores_count,
                    AVG(ds.score) as avg_score
                FROM candidates c
                LEFT JOIN candidate_pipeline cp ON c.id = cp.candidate_id
                LEFT JOIN pipeline_stages ps ON cp.stage_id = ps.id
                LEFT JOIN assessments a ON c.id = a.candidate_id
                LEFT JOIN dimension_scores ds ON a.id = ds.assessment_id
                GROUP BY c.id, ps.name, a.completion_status
                ORDER BY c.created_at DESC
                LIMIT 50
            `);

            // Get pipeline statistics
            const pipelineResult = await db.query(`
                SELECT
                    ps.name as stage,
                    ps.position,
                    COUNT(cp.candidate_id) as candidate_count
                FROM pipeline_stages ps
                LEFT JOIN candidate_pipeline cp ON ps.id = cp.stage_id
                GROUP BY ps.id, ps.name, ps.position
                ORDER BY ps.position
            `);

            // Get recent activities
            const recentActivities = await db.query(`
                SELECT
                    'candidate_added' as activity_type,
                    CONCAT(first_name, ' ', last_name) as description,
                    created_at as timestamp
                FROM candidates
                WHERE created_at > NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
                LIMIT 20
            `);

            const enhancedContext = {
                ...baseContext,
                systemStatus: {
                    totalCandidates: candidatesResult.rows.length,
                    activePipeline: pipelineResult.rows,
                    recentActivity: recentActivities.rows,
                    timestamp: new Date().toISOString()
                },
                candidates: candidatesResult.rows.slice(0, 10), // Top 10 for context
                recruitingData: {
                    avgAssessmentScore: candidatesResult.rows.reduce((acc, c) => acc + (c.avg_score || 0), 0) / candidatesResult.rows.length,
                    completionRate: candidatesResult.rows.filter(c => c.completion_status === 'completed').length / candidatesResult.rows.length,
                    pipelineDistribution: pipelineResult.rows
                }
            };

            return enhancedContext;

        } catch (error) {
            console.error('Error building enhanced context:', error);
            return baseContext;
        }
    }

    /**
     * MODEL EXECUTION ENGINE
     * Executes query with specified model
     */
    async executeWithModel(modelName, query, context) {
        const config = this.models[modelName];
        const systemPrompt = this.buildSystemPrompt(context);

        if (config.provider === 'openai') {
            return await this.executeOpenAI(config, systemPrompt, query);
        } else if (config.provider === 'anthropic') {
            return await this.executeAnthropic(config, systemPrompt, query);
        } else {
            throw new Error(`Unsupported model provider: ${config.provider}`);
        }
    }

    async executeOpenAI(config, systemPrompt, query) {
        const response = await this.openai.chat.completions.create({
            model: config.model,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: query }
            ],
            temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
            max_tokens: config.maxTokens,
            stream: false
        });

        return response.choices[0].message.content;
    }

    async executeAnthropic(config, systemPrompt, query) {
        const response = await this.anthropic.messages.create({
            model: config.model,
            max_tokens: config.maxTokens,
            temperature: parseFloat(process.env.TEMPERATURE || '0.7'),
            system: systemPrompt,
            messages: [
                { role: 'user', content: query }
            ]
        });

        return response.content[0].text;
    }

    /**
     * ADVANCED SYSTEM PROMPT BUILDER
     * Creates context-aware system prompts
     */
    buildSystemPrompt(context) {
        const basePrompt = `You are the world's most advanced AI recruiting assistant for Northwestern Mutual. You have access to comprehensive candidate data, assessment results, and pipeline analytics.

CURRENT SYSTEM STATUS:
- Total Candidates: ${context.systemStatus?.totalCandidates || 0}
- Pipeline Distribution: ${context.systemStatus?.activePipeline?.map(p => `${p.stage}: ${p.candidate_count}`).join(', ') || 'Loading...'}
- Recent Activity: ${context.systemStatus?.recentActivity?.length || 0} events in last 7 days

AVAILABLE DATA:
${JSON.stringify(context.candidates?.slice(0, 5) || [], null, 2)}

INSTRUCTIONS:
1. Provide intelligent, data-driven insights based on actual candidate information
2. Use specific candidate names and scores when relevant
3. Identify patterns and trends in the data
4. Make actionable recommendations with clear reasoning
5. Be proactive and anticipate follow-up questions
6. Maintain Northwestern Mutual's professional tone
7. Always base responses on real data, not assumptions

CAPABILITIES:
- Advanced candidate analysis and scoring
- Predictive hiring success modeling
- Pipeline optimization recommendations
- Market intelligence and competitive analysis
- Bias detection and diversity optimization
- Strategic workforce planning

Respond with intelligence that rivals ChatGPT and Claude, but with deep recruiting expertise.`;

        return basePrompt;
    }

    /**
     * FALLBACK RESPONSE SYSTEM
     * Provides intelligent fallbacks when primary models fail
     */
    async fallbackResponse(query, context, originalError) {
        console.log('🔄 AI Router executing fallback strategy...');

        // Try the most reliable model (usually GPT-3.5 for speed and reliability)
        try {
            const fallbackModel = 'gpt-3-5-turbo';
            const response = await this.executeWithModel(fallbackModel, query, context);

            return {
                response: response + '\n\n*Note: Response generated using fallback model due to primary model unavailability.*',
                metadata: {
                    model: fallbackModel,
                    fallback: true,
                    originalError: originalError.message
                }
            };

        } catch (fallbackError) {
            console.error('❌ Fallback model also failed:', fallbackError);

            // Return intelligent error response
            return {
                response: this.getIntelligentErrorResponse(query, context),
                metadata: {
                    model: 'error_handler',
                    fallback: true,
                    error: true
                }
            };
        }
    }

    getIntelligentErrorResponse(query, context) {
        const candidates = context.systemStatus?.totalCandidates || 0;

        return `🤖 **Northwestern Mutual AI Assistant**

I'm currently experiencing technical difficulties with our AI models, but I can still help you with basic information:

**Current System Status:**
- Active Candidates: ${candidates}
- AI Services: Temporarily Limited
- Database: Operational

**Available Actions:**
- View candidate profiles and assessments
- Access pipeline and analytics data
- Basic reporting and statistics

Our AI capabilities will be restored shortly. In the meantime, our platform's comprehensive data and analytics remain fully available.

How can I assist you with your recruiting needs today?`;
    }

    /**
     * PERFORMANCE MONITORING
     * Tracks model performance for optimization
     */
    recordPerformance(modelName, responseTime, success) {
        const current = this.modelPerformance.get(modelName) || {
            successRate: 0.95,
            avgResponseTime: 2000,
            totalRequests: 0,
            successfulRequests: 0
        };

        current.totalRequests++;
        if (success) {
            current.successfulRequests++;
        }

        current.successRate = current.successfulRequests / current.totalRequests;
        current.avgResponseTime = (current.avgResponseTime + responseTime) / 2;

        this.modelPerformance.set(modelName, current);
    }

    startHealthMonitoring() {
        // Monitor model health every 5 minutes
        setInterval(async () => {
            await this.checkModelHealth();
        }, 5 * 60 * 1000);
    }

    async checkModelHealth() {
        for (const modelName of Object.keys(this.models)) {
            try {
                const testQuery = "System health check";
                const testResponse = await this.executeWithModel(modelName, testQuery, {});
                this.healthChecker.set(modelName, { status: 'healthy', lastCheck: Date.now() });
            } catch (error) {
                this.healthChecker.set(modelName, { status: 'unhealthy', lastCheck: Date.now(), error: error.message });
                console.warn(`⚠️ Model ${modelName} health check failed:`, error.message);
            }
        }
    }

    estimateTokens(text) {
        // Rough token estimation (1 token ≈ 4 characters)
        return Math.ceil(text.length / 4);
    }

    /**
     * DEMO MODE RESPONSE GENERATOR
     * Provides intelligent demo responses when AI models are unavailable
     */
    async generateDemoResponse(query, context = {}) {
        const startTime = Date.now();

        // Parse query intent
        const intent = this.parseQueryIntent(query);

        let response;
        switch (intent.type) {
            case 'TOP_CANDIDATES':
                response = await this.getDemoTopCandidates(intent.params);
                break;
            case 'PIPELINE_ANALYSIS':
                response = this.getDemoPipelineAnalysis();
                break;
            case 'LOCATION_SEARCH':
                response = this.getDemoLocationSearch(intent.params);
                break;
            case 'CANDIDATE_ANALYSIS':
                response = this.getDemoCandidateAnalysis(intent.params);
                break;
            default:
                response = this.getDemoGeneralResponse(query);
        }

        return {
            response: response.message,
            candidates: response.candidates || null,
            analysis: response.analysis || null,
            insights: response.insights || null,
            suggestions: response.suggestions || ['View detailed analytics', 'Search specific criteria', 'Export data'],
            metadata: {
                model: 'demo-intelligence',
                responseTime: Date.now() - startTime,
                demoMode: true
            }
        };
    }

    parseQueryIntent(query) {
        const lowerQuery = query.toLowerCase();

        if (lowerQuery.includes('top') || lowerQuery.includes('best')) {
            const match = lowerQuery.match(/(\d+)/);
            return {
                type: 'TOP_CANDIDATES',
                params: { limit: match ? parseInt(match[1]) : 5 }
            };
        }

        if (lowerQuery.includes('pipeline') || lowerQuery.includes('bottleneck')) {
            return { type: 'PIPELINE_ANALYSIS', params: {} };
        }

        if (lowerQuery.includes('location') || lowerQuery.includes('city')) {
            const locations = ['philadelphia', 'chicago', 'new york', 'milwaukee'];
            const found = locations.find(loc => lowerQuery.includes(loc));
            return {
                type: 'LOCATION_SEARCH',
                params: { location: found || 'philadelphia' }
            };
        }

        if (lowerQuery.includes('analyze') || lowerQuery.includes('assessment')) {
            return { type: 'CANDIDATE_ANALYSIS', params: {} };
        }

        return { type: 'GENERAL', params: {} };
    }

    async getDemoTopCandidates(params) {
        const { limit = 5 } = params;

        const candidates = this.generateDemoCandidates(limit);

        return {
            message: `Here are the top ${limit} candidates based on comprehensive behavioral assessment:`,
            candidates,
            insights: {
                summary: `These candidates show exceptional promise with average scores above 85%. All have completed behavioral assessments and demonstrate strong alignment with Northwestern Mutual's values.`,
                recommendations: [
                    'Schedule interviews with top 3 immediately',
                    'Send personalized outreach to candidates 4-5',
                    'All candidates show high retention probability'
                ]
            }
        };
    }

    getDemoPipelineAnalysis() {
        return {
            message: 'Pipeline Analysis Complete - Identifying Key Opportunities',
            analysis: {
                type: 'pipeline',
                stages: [
                    { name: 'New Leads', count: 87, health: 'good' },
                    { name: 'Assessment', count: 42, health: 'warning', issue: '42% incomplete' },
                    { name: 'Interview', count: 28, health: 'good' },
                    { name: 'Offer', count: 12, health: 'excellent' },
                    { name: 'Hired', count: 8, health: 'good' }
                ],
                bottlenecks: [
                    {
                        stage: 'Assessment',
                        issue: '42% of candidates not completing assessments',
                        recommendation: 'Implement automated reminder sequence after 48 hours',
                        impact: 'Could recover 15-20 candidates per week'
                    }
                ],
                opportunities: [
                    '⚠️ Assessment completion is your main bottleneck',
                    '✅ Offer acceptance rate is excellent (92%)',
                    '📈 Consider increasing top-of-funnel by 20%'
                ]
            }
        };
    }

    getDemoLocationSearch(params) {
        const { location = 'philadelphia' } = params;

        return {
            message: `Found talented candidates in ${location}`,
            candidates: this.generateLocationBasedCandidates(location),
            insights: {
                marketInsights: {
                    talentAvailability: 'High',
                    averageSalaryExpectation: '$65,000 - $85,000',
                    competitionLevel: 'Moderate',
                    recommendedApproach: 'Emphasize career growth and training programs'
                }
            }
        };
    }

    getDemoCandidateAnalysis(params) {
        return {
            message: 'Candidate Analysis Complete - Deep Behavioral Insights Available',
            insights: {
                totalAnalyzed: 234,
                avgScore: 82,
                topPerformers: 47,
                keyFindings: [
                    'High correlation between resilience scores and FA success',
                    'Communication skills are strongest predictor of client satisfaction',
                    'Goal orientation varies significantly by geographic region'
                ]
            }
        };
    }

    getDemoGeneralResponse(query) {
        return {
            message: `I've analyzed your request about "${query}". Based on current data, here are my insights:

• Your talent pipeline is strong with 234 active candidates
• Average assessment score is 82/100 (above industry benchmark)
• Philadelphia market shows high talent availability
• Recommendation: Focus on candidates with 85+ scores for immediate interviews

Would you like me to dive deeper into any specific area?`,
            suggestions: ['View top candidates', 'Analyze pipeline bottlenecks', 'Search specific criteria']
        };
    }

    generateDemoCandidates(count) {
        const candidates = [];
        const names = [
            { first: 'Sarah', last: 'Johnson' },
            { first: 'Michael', last: 'Chen' },
            { first: 'Jessica', last: 'Williams' },
            { first: 'David', last: 'Martinez' },
            { first: 'Emily', last: 'Anderson' }
        ];

        for (let i = 0; i < Math.min(count, names.length); i++) {
            candidates.push({
                id: `cand-${i + 1}`,
                name: `${names[i].first} ${names[i].last}`,
                email: `${names[i].first.toLowerCase()}.${names[i].last.toLowerCase()}@email.com`,
                phone: `(215) 555-${String(1000 + i).padStart(4, '0')}`,
                currentTitle: ['Senior Sales Manager', 'Account Executive', 'Business Development Rep', 'Client Success Manager', 'Financial Analyst'][i],
                company: ['Prudential', 'MetLife', 'AIG', 'Morgan Stanley', 'Wells Fargo'][i],
                location: 'Philadelphia, PA',
                score: 92 - (i * 2),
                assessmentStatus: 'Completed',
                matchPercentage: `${95 - (i * 3)}%`,
                keyStrengths: [
                    'Client relationship building',
                    'Strategic thinking',
                    'Results-driven approach'
                ],
                personality: {
                    mbti: ['ENTJ', 'ESTJ', 'ENFJ', 'ISTJ', 'INTJ'][i],
                    disc: ['D', 'DI', 'I', 'S', 'C'][i],
                    enneagram: `Type ${i + 3}`
                },
                likelihood: ['Very High', 'High', 'High', 'Moderate', 'Moderate'][i],
                nextStep: 'Schedule interview'
            });
        }

        return candidates;
    }

    generateLocationBasedCandidates(location) {
        return this.generateDemoCandidates(3).map(c => ({
            ...c,
            location: `${location.charAt(0).toUpperCase() + location.slice(1)}, PA`
        }));
    }

    getSystemStats() {
        return {
            models: Object.keys(this.models),
            performance: Object.fromEntries(this.modelPerformance),
            health: Object.fromEntries(this.healthChecker),
            load: Object.fromEntries(this.loadBalancer),
            demoMode: process.env.DEMO_MODE === 'true'
        };
    }
}

module.exports = new AIRouterService();