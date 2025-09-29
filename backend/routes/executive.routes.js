/**
 * Elite Executive Dashboard API Routes
 * Fortune 100 Grade Executive Intelligence Endpoints
 * Northwestern Mutual Executive Analytics Platform
 */

const express = require('express');
const router = express.Router();
const { auth, requireRole } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const AIIntelligenceService = require('../services/ai-intelligence.service');
const ExecutiveAnalyticsService = require('../services/executive-analytics.service');
const PredictiveModelingService = require('../services/predictive-modeling.service');
const MarketIntelligenceService = require('../services/market-intelligence.service');

// Initialize elite services
const aiIntelligence = new AIIntelligenceService();
const executiveAnalytics = new ExecutiveAnalyticsService();
const predictiveModeling = new PredictiveModelingService();
const marketIntelligence = new MarketIntelligenceService();

// Executive-grade rate limiting
const executiveRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 100, // Generous limit for executive users
    message: {
        error: 'Executive dashboard rate limit exceeded',
        retryAfter: '1 minute'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Apply rate limiting and authentication to all routes
router.use(executiveRateLimit);
router.use(auth);
router.use(requireRole(['executive', 'admin', 'senior_recruiter']));

/**
 * @route GET /api/executive/kpis
 * @desc Get executive KPI dashboard data
 * @access Executive
 */
router.get('/kpis', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;
        const startTime = Date.now();

        // Parallel data fetching for optimal performance
        const [
            revenueData,
            efficiencyData,
            qualityData,
            retentionData,
            trendData
        ] = await Promise.all([
            executiveAnalytics.getRevenueImpact(timeframe),
            executiveAnalytics.getHiringEfficiency(timeframe),
            executiveAnalytics.getHireQualityScore(timeframe),
            executiveAnalytics.getRetentionMetrics(timeframe),
            executiveAnalytics.getTrendAnalysis(timeframe)
        ]);

        const responseTime = Date.now() - startTime;

        const kpiData = {
            revenue: {
                value: revenueData.totalImpact,
                trend: revenueData.trendPercentage,
                timeSeries: revenueData.timeSeries,
                benchmark: revenueData.industryBenchmark
            },
            efficiency: {
                value: efficiencyData.averageTimeToHire,
                trend: efficiencyData.improvementPercentage,
                timeSeries: efficiencyData.timeSeries,
                benchmark: efficiencyData.industryAverage
            },
            quality: {
                value: qualityData.successRate,
                trend: qualityData.trendPercentage,
                timeSeries: qualityData.timeSeries,
                confidenceInterval: qualityData.confidenceInterval
            },
            retention: {
                value: retentionData.retentionRate,
                trend: retentionData.trendPercentage,
                timeSeries: retentionData.timeSeries,
                riskFactors: retentionData.riskFactors
            },
            trends: trendData,
            metadata: {
                responseTime,
                dataFreshness: executiveAnalytics.getDataFreshness(),
                confidenceLevel: 0.95
            }
        };

        res.json({
            success: true,
            data: kpiData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Executive KPI Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve executive KPI data',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @route GET /api/executive/pipeline-health
 * @desc Get comprehensive pipeline health metrics
 * @access Executive
 */
router.get('/pipeline-health', async (req, res) => {
    try {
        const { timeframe = '30d' } = req.query;

        const pipelineHealth = await executiveAnalytics.getPipelineHealthMetrics(timeframe);

        const healthData = {
            overall: {
                healthScore: pipelineHealth.overallScore,
                status: pipelineHealth.healthStatus,
                trend: pipelineHealth.trend
            },
            metrics: {
                activeCandidates: pipelineHealth.activeCandidates,
                qualifiedLeads: pipelineHealth.qualifiedLeads,
                interviewReady: pipelineHealth.interviewReady,
                offerPending: pipelineHealth.offerPending
            },
            velocity: {
                averageVelocity: pipelineHealth.averageVelocity,
                bottlenecks: pipelineHealth.bottlenecks,
                fastTrackOpportunities: pipelineHealth.fastTrackOpportunities
            },
            predictive: {
                expectedHires: pipelineHealth.expectedHires,
                confidenceInterval: pipelineHealth.confidenceInterval,
                riskFactors: pipelineHealth.riskFactors
            },
            chartData: pipelineHealth.chartData
        };

        res.json({
            success: true,
            data: healthData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Pipeline Health Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve pipeline health data'
        });
    }
});

/**
 * @route GET /api/executive/ai-performance
 * @desc Get AI system performance metrics
 * @access Executive
 */
router.get('/ai-performance', async (req, res) => {
    try {
        const aiPerformance = await aiIntelligence.getSystemPerformanceMetrics();

        const performanceData = {
            overall: {
                performanceScore: aiPerformance.overallScore,
                status: aiPerformance.systemStatus,
                uptime: aiPerformance.uptime
            },
            prediction: {
                accuracy: aiPerformance.predictionAccuracy,
                confidence: aiPerformance.modelConfidence,
                successRate: aiPerformance.successRate,
                falsePositiveRate: aiPerformance.falsePositiveRate
            },
            processing: {
                averageResponseTime: aiPerformance.averageResponseTime,
                throughput: aiPerformance.throughput,
                queueLength: aiPerformance.queueLength
            },
            learning: {
                modelVersion: aiPerformance.modelVersion,
                lastTraining: aiPerformance.lastTraining,
                datasetSize: aiPerformance.datasetSize,
                improvementRate: aiPerformance.improvementRate
            },
            metrics: {
                totalPredictions: aiPerformance.totalPredictions,
                successfulMatches: aiPerformance.successfulMatches,
                timeSaved: aiPerformance.timeSaved,
                costSavings: aiPerformance.costSavings
            }
        };

        res.json({
            success: true,
            data: performanceData,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('AI Performance Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve AI performance data'
        });
    }
});

/**
 * @route GET /api/executive/market-intelligence
 * @desc Get real-time market intelligence
 * @access Executive
 */
router.get('/market-intelligence', async (req, res) => {
    try {
        const marketData = await marketIntelligence.getExecutiveIntelligence();

        const intelligenceData = {
            alerts: {
                critical: marketData.criticalAlerts,
                opportunities: marketData.opportunities,
                threats: marketData.threats
            },
            competitive: {
                competitorActivity: marketData.competitorActivity,
                salaryTrends: marketData.salaryTrends,
                marketShare: marketData.marketShare,
                talentAvailability: marketData.talentAvailability
            },
            insights: {
                marketTrends: marketData.marketTrends,
                demandForecasts: marketData.demandForecasts,
                supplyAnalysis: marketData.supplyAnalysis,
                riskAssessment: marketData.riskAssessment
            },
            actionable: {
                recommendations: marketData.recommendations,
                urgentActions: marketData.urgentActions,
                opportunities: marketData.strategicOpportunities
            }
        };

        res.json({
            success: true,
            data: intelligenceData,
            timestamp: new Date().toISOString(),
            freshness: marketData.dataFreshness
        });

    } catch (error) {
        console.error('Market Intelligence Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve market intelligence'
        });
    }
});

/**
 * @route GET /api/executive/predictive-forecast
 * @desc Get predictive hiring forecasts
 * @access Executive
 */
router.get('/predictive-forecast', async (req, res) => {
    try {
        const { timeframe = '90d' } = req.query;

        const forecastData = await predictiveModeling.generateExecutiveForecast(timeframe);

        const forecast = {
            predictions: {
                expectedHires: forecastData.expectedHires,
                revenueImpact: forecastData.revenueImpact,
                successProbability: forecastData.successProbability,
                confidenceLevel: forecastData.confidenceLevel
            },
            timeline: {
                quarterly: forecastData.quarterlyProjections,
                monthly: forecastData.monthlyProjections,
                weekly: forecastData.weeklyProjections
            },
            scenarios: {
                optimistic: forecastData.optimisticScenario,
                realistic: forecastData.realisticScenario,
                pessimistic: forecastData.pessimisticScenario
            },
            factors: {
                influencingFactors: forecastData.influencingFactors,
                riskMitigation: forecastData.riskMitigation,
                opportunities: forecastData.opportunities
            },
            chartData: forecastData.chartData
        };

        res.json({
            success: true,
            data: forecast,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Predictive Forecast Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate predictive forecast'
        });
    }
});

/**
 * @route GET /api/executive/roi-analysis
 * @desc Get comprehensive ROI analysis
 * @access Executive
 */
router.get('/roi-analysis', async (req, res) => {
    try {
        const { timeframe = '12m' } = req.query;

        const roiData = await executiveAnalytics.getROIAnalysis(timeframe);

        const roiAnalysis = {
            overview: {
                totalROI: roiData.totalROI,
                roiPercentage: roiData.roiPercentage,
                paybackPeriod: roiData.paybackPeriod,
                netPresentValue: roiData.netPresentValue
            },
            investment: {
                platformCosts: roiData.platformCosts,
                implementationCosts: roiData.implementationCosts,
                operationalCosts: roiData.operationalCosts,
                totalInvestment: roiData.totalInvestment
            },
            returns: {
                efficiencySavings: roiData.efficiencySavings,
                qualityImprovements: roiData.qualityImprovements,
                retentionSavings: roiData.retentionSavings,
                revenueIncrease: roiData.revenueIncrease,
                totalReturns: roiData.totalReturns
            },
            breakdown: {
                timeToHireReduction: roiData.timeToHireReduction,
                costPerHireReduction: roiData.costPerHireReduction,
                qualityScoreImprovement: roiData.qualityScoreImprovement,
                retentionImprovement: roiData.retentionImprovement
            },
            benchmarks: {
                industryAverage: roiData.industryBenchmarks,
                topPerformers: roiData.topPerformerBenchmarks,
                ourPosition: roiData.ourPosition
            },
            chartData: roiData.chartData
        };

        res.json({
            success: true,
            data: roiAnalysis,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('ROI Analysis Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve ROI analysis'
        });
    }
});

/**
 * @route GET /api/executive/benchmarks
 * @desc Get industry benchmarks and competitive positioning
 * @access Executive
 */
router.get('/benchmarks', async (req, res) => {
    try {
        const benchmarkData = await executiveAnalytics.getBenchmarkAnalysis();

        const benchmarks = {
            performance: {
                timeToHire: {
                    ourValue: benchmarkData.timeToHire.our,
                    industryAverage: benchmarkData.timeToHire.industry,
                    topQuartile: benchmarkData.timeToHire.topQuartile,
                    percentileRank: benchmarkData.timeToHire.percentile
                },
                costPerHire: {
                    ourValue: benchmarkData.costPerHire.our,
                    industryAverage: benchmarkData.costPerHire.industry,
                    topQuartile: benchmarkData.costPerHire.topQuartile,
                    percentileRank: benchmarkData.costPerHire.percentile
                },
                retentionRate: {
                    ourValue: benchmarkData.retentionRate.our,
                    industryAverage: benchmarkData.retentionRate.industry,
                    topQuartile: benchmarkData.retentionRate.topQuartile,
                    percentileRank: benchmarkData.retentionRate.percentile
                },
                qualityScore: {
                    ourValue: benchmarkData.qualityScore.our,
                    industryAverage: benchmarkData.qualityScore.industry,
                    topQuartile: benchmarkData.qualityScore.topQuartile,
                    percentileRank: benchmarkData.qualityScore.percentile
                }
            },
            competitive: {
                marketPosition: benchmarkData.marketPosition,
                competitiveAdvantages: benchmarkData.competitiveAdvantages,
                improvementOpportunities: benchmarkData.improvementOpportunities
            },
            trends: {
                industryTrends: benchmarkData.industryTrends,
                emergingPractices: benchmarkData.emergingPractices,
                futureOutlook: benchmarkData.futureOutlook
            }
        };

        res.json({
            success: true,
            data: benchmarks,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Benchmarks Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve benchmark data'
        });
    }
});

/**
 * @route POST /api/executive/reports/generate
 * @desc Generate comprehensive executive report
 * @access Executive
 */
router.post('/reports/generate', async (req, res) => {
    try {
        const {
            timeframe = '30d',
            format = 'pdf',
            sections = ['all'],
            recipients = []
        } = req.body;

        const reportData = await executiveAnalytics.generateComprehensiveReport({
            timeframe,
            sections,
            requestedBy: req.user.id,
            generatedAt: new Date().toISOString()
        });

        const report = {
            reportId: reportData.id,
            downloadUrl: reportData.downloadUrl,
            previewUrl: reportData.previewUrl,
            format,
            generatedAt: reportData.generatedAt,
            validUntil: reportData.validUntil,
            sections: reportData.includedSections,
            metadata: {
                totalPages: reportData.totalPages,
                fileSize: reportData.fileSize,
                securityLevel: 'Executive Confidential'
            }
        };

        // Send email notifications if recipients specified
        if (recipients.length > 0) {
            await executiveAnalytics.emailReport(report, recipients);
        }

        res.json({
            success: true,
            data: report,
            message: 'Executive report generated successfully'
        });

    } catch (error) {
        console.error('Report Generation Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate executive report'
        });
    }
});

/**
 * @route GET /api/executive/alerts
 * @desc Get real-time executive alerts
 * @access Executive
 */
router.get('/alerts', async (req, res) => {
    try {
        const { severity = 'all', limit = 50 } = req.query;

        const alerts = await executiveAnalytics.getExecutiveAlerts({
            severity,
            limit,
            userId: req.user.id
        });

        res.json({
            success: true,
            data: alerts,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Executive Alerts Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve executive alerts'
        });
    }
});

/**
 * @route POST /api/executive/alerts/:id/acknowledge
 * @desc Acknowledge an executive alert
 * @access Executive
 */
router.post('/alerts/:id/acknowledge', async (req, res) => {
    try {
        const { id } = req.params;
        const { action, notes } = req.body;

        await executiveAnalytics.acknowledgeAlert(id, {
            acknowledgedBy: req.user.id,
            action,
            notes,
            acknowledgedAt: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'Alert acknowledged successfully'
        });

    } catch (error) {
        console.error('Alert Acknowledgment Error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to acknowledge alert'
        });
    }
});

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('Executive API Error:', error);

    res.status(error.status || 500).json({
        success: false,
        error: error.message || 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId: req.id
    });
});

module.exports = router;