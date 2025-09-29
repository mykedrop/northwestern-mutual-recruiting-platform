/**
 * Elite Executive Dashboard Controller
 * Fortune 100 Grade Real-time Intelligence Platform
 * Northwestern Mutual Executive Intelligence System
 */

class ExecutiveDashboardController {
    constructor() {
        this.apiClient = new APIClient();
        this.socket = null;
        this.charts = {};
        this.realTimeData = {};
        this.refreshInterval = null;
        this.currentView = 'overview';
        this.timeframe = '30d';

        // Performance monitoring
        this.performanceMetrics = {
            loadTime: 0,
            apiResponseTimes: [],
            chartRenderTimes: [],
            lastUpdate: null
        };

        // Real-time data cache
        this.dataCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes

        this.initializePerformanceMonitoring();
    }

    async initialize() {
        const startTime = performance.now();

        try {
            console.log('🏢 Initializing Executive Dashboard...');

            // Initialize real-time connection
            await this.initializeRealTimeConnection();

            // Setup event listeners
            this.setupEventListeners();

            // Load initial data with parallel requests
            await this.loadInitialData();

            // Initialize charts
            await this.initializeCharts();

            // Start real-time updates
            this.startRealTimeUpdates();

            // Set up auto-refresh
            this.setupAutoRefresh();

            const loadTime = performance.now() - startTime;
            this.performanceMetrics.loadTime = loadTime;

            console.log(`✅ Executive Dashboard initialized in ${Math.round(loadTime)}ms`);

            // Show performance metrics in development
            if (process.env.NODE_ENV === 'development') {
                this.showPerformanceMetrics();
            }

        } catch (error) {
            console.error('❌ Failed to initialize Executive Dashboard:', error);
            this.showErrorState(error);
        }
    }

    async initializeRealTimeConnection() {
        return new Promise((resolve, reject) => {
            this.socket = io('http://localhost:3001', {
                transports: ['websocket'],
                auth: {
                    token: localStorage.getItem('accessToken'),
                    role: 'executive'
                }
            });

            this.socket.on('connect', () => {
                console.log('🔗 Real-time connection established');
                this.updateConnectionStatus(true);
                resolve();
            });

            this.socket.on('disconnect', () => {
                console.log('📶 Real-time connection lost');
                this.updateConnectionStatus(false);
            });

            this.socket.on('connect_error', (error) => {
                console.error('🚨 Real-time connection failed:', error);
                reject(error);
            });

            // Real-time data handlers
            this.socket.on('executive-metrics-update', (data) => {
                this.handleRealTimeMetricsUpdate(data);
            });

            this.socket.on('critical-alert', (alert) => {
                this.handleCriticalAlert(alert);
            });

            this.socket.on('market-intelligence-update', (intel) => {
                this.handleMarketIntelligenceUpdate(intel);
            });
        });
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-pill').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        // Timeframe selector
        document.getElementById('timeframe')?.addEventListener('change', (e) => {
            this.updateTimeframe(e.target.value);
        });

        // Export functionality
        document.querySelector('.export-executive-btn')?.addEventListener('click', () => {
            this.exportExecutiveReport();
        });

        // Alert actions
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('alert-action')) {
                this.handleAlertAction(e.target);
            }
        });

        // Logout
        document.getElementById('executive-logout')?.addEventListener('click', () => {
            this.logout();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Window visibility for performance optimization
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pauseRealTimeUpdates();
            } else {
                this.resumeRealTimeUpdates();
            }
        });
    }

    async loadInitialData() {
        const promises = [
            this.loadKPIData(),
            this.loadPipelineHealth(),
            this.loadAIPerformanceMetrics(),
            this.loadMarketIntelligence(),
            this.loadPredictiveForecast(),
            this.loadROIAnalysis(),
            this.loadBenchmarkData()
        ];

        const results = await Promise.allSettled(promises);

        // Log any failed requests
        results.forEach((result, index) => {
            if (result.status === 'rejected') {
                console.warn(`Failed to load data source ${index}:`, result.reason);
            }
        });
    }

    async loadKPIData() {
        const cacheKey = `kpi-data-${this.timeframe}`;
        if (this.isCacheValid(cacheKey)) {
            return this.dataCache.get(cacheKey);
        }

        try {
            const startTime = performance.now();
            const data = await this.apiClient.get(`/api/executive/kpis?timeframe=${this.timeframe}`);
            const responseTime = performance.now() - startTime;

            this.performanceMetrics.apiResponseTimes.push({
                endpoint: 'kpis',
                time: responseTime,
                timestamp: Date.now()
            });

            // Update KPI displays
            this.updateKPIDisplays(data);

            // Cache the data
            this.dataCache.set(cacheKey, data);

            return data;
        } catch (error) {
            console.error('Failed to load KPI data:', error);
            this.showKPIError();
            throw error;
        }
    }

    async loadPipelineHealth() {
        try {
            const data = await this.apiClient.get(`/api/executive/pipeline-health?timeframe=${this.timeframe}`);
            this.updatePipelineHealthDisplay(data);
            return data;
        } catch (error) {
            console.error('Failed to load pipeline health:', error);
            this.showPipelineError();
        }
    }

    async loadAIPerformanceMetrics() {
        try {
            const data = await this.apiClient.get('/api/executive/ai-performance');
            this.updateAIPerformanceDisplay(data);
            return data;
        } catch (error) {
            console.error('Failed to load AI performance:', error);
            this.showAIPerformanceError();
        }
    }

    async loadMarketIntelligence() {
        try {
            const data = await this.apiClient.get('/api/executive/market-intelligence');
            this.updateMarketIntelligenceDisplay(data);
            return data;
        } catch (error) {
            console.error('Failed to load market intelligence:', error);
            this.showMarketIntelError();
        }
    }

    async loadPredictiveForecast() {
        try {
            const data = await this.apiClient.get(`/api/executive/predictive-forecast?timeframe=${this.timeframe}`);
            this.updatePredictiveForecastDisplay(data);
            return data;
        } catch (error) {
            console.error('Failed to load predictive forecast:', error);
        }
    }

    async loadROIAnalysis() {
        try {
            const data = await this.apiClient.get(`/api/executive/roi-analysis?timeframe=${this.timeframe}`);
            this.updateROIAnalysisDisplay(data);
            return data;
        } catch (error) {
            console.error('Failed to load ROI analysis:', error);
        }
    }

    async loadBenchmarkData() {
        try {
            const data = await this.apiClient.get('/api/executive/benchmarks');
            this.updateBenchmarkDisplay(data);
            return data;
        } catch (error) {
            console.error('Failed to load benchmark data:', error);
        }
    }

    async initializeCharts() {
        const chartPromises = [
            this.initializeKPICharts(),
            this.initializePipelineChart(),
            this.initializeForecastChart(),
            this.initializeROIChart()
        ];

        await Promise.all(chartPromises);
        console.log('📊 All charts initialized');
    }

    async initializeKPICharts() {
        // Revenue Chart
        const revenueCtx = document.getElementById('revenue-chart')?.getContext('2d');
        if (revenueCtx) {
            this.charts.revenue = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Revenue',
                        data: [],
                        borderColor: '#d4af37',
                        backgroundColor: 'rgba(212, 175, 55, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: this.getChartOptions('revenue')
            });
        }

        // Efficiency Chart
        const efficiencyCtx = document.getElementById('efficiency-chart')?.getContext('2d');
        if (efficiencyCtx) {
            this.charts.efficiency = new Chart(efficiencyCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Days to Hire',
                        data: [],
                        backgroundColor: 'rgba(0, 168, 107, 0.8)',
                        borderColor: '#00a86b',
                        borderWidth: 1
                    }]
                },
                options: this.getChartOptions('efficiency')
            });
        }

        // Quality Chart
        const qualityCtx = document.getElementById('quality-chart')?.getContext('2d');
        if (qualityCtx) {
            this.charts.quality = new Chart(qualityCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Success', 'At Risk'],
                    datasets: [{
                        data: [94.2, 5.8],
                        backgroundColor: ['#4169e1', '#e0e0e0'],
                        borderWidth: 0
                    }]
                },
                options: this.getChartOptions('quality')
            });
        }

        // Retention Chart
        const retentionCtx = document.getElementById('retention-chart')?.getContext('2d');
        if (retentionCtx) {
            this.charts.retention = new Chart(retentionCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Retention %',
                        data: [],
                        borderColor: '#ff6b6b',
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: this.getChartOptions('retention')
            });
        }
    }

    getChartOptions(type) {
        const baseOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 31, 63, 0.9)',
                    titleColor: '#fff',
                    bodyColor: '#fff',
                    cornerRadius: 8,
                    padding: 12
                }
            },
            scales: {
                x: {
                    display: false,
                    grid: {
                        display: false
                    }
                },
                y: {
                    display: false,
                    grid: {
                        display: false
                    }
                }
            },
            elements: {
                point: {
                    radius: 0
                }
            }
        };

        // Type-specific customizations
        if (type === 'quality') {
            baseOptions.cutout = '70%';
            delete baseOptions.scales;
        }

        return baseOptions;
    }

    updateKPIDisplays(data) {
        // Update revenue impact
        const revenueValue = document.querySelector('.kpi-card.revenue .kpi-value');
        const revenueTrend = document.querySelector('.kpi-card.revenue .trend-percent');
        if (revenueValue && data.revenue) {
            revenueValue.textContent = this.formatCurrency(data.revenue.value);
            if (revenueTrend) {
                revenueTrend.textContent = `+${data.revenue.trend}%`;
            }
        }

        // Update efficiency
        const efficiencyValue = document.querySelector('.kpi-card.efficiency .kpi-value');
        const efficiencyTrend = document.querySelector('.kpi-card.efficiency .trend-percent');
        if (efficiencyValue && data.efficiency) {
            efficiencyValue.textContent = `${data.efficiency.value} days`;
            if (efficiencyTrend) {
                efficiencyTrend.textContent = `+${data.efficiency.trend}%`;
            }
        }

        // Update quality score
        const qualityValue = document.querySelector('.kpi-card.quality .kpi-value');
        const qualityTrend = document.querySelector('.kpi-card.quality .trend-percent');
        if (qualityValue && data.quality) {
            qualityValue.textContent = `${data.quality.value}%`;
            if (qualityTrend) {
                qualityTrend.textContent = `+${data.quality.trend}%`;
            }
        }

        // Update retention rate
        const retentionValue = document.querySelector('.kpi-card.retention .kpi-value');
        const retentionTrend = document.querySelector('.kpi-card.retention .trend-percent');
        if (retentionValue && data.retention) {
            retentionValue.textContent = `${data.retention.value}%`;
            if (retentionTrend) {
                retentionTrend.textContent = `+${data.retention.trend}%`;
            }
        }

        // Update charts with new data
        this.updateKPICharts(data);
    }

    updateKPICharts(data) {
        // Update revenue chart
        if (this.charts.revenue && data.revenue?.timeSeries) {
            this.charts.revenue.data.labels = data.revenue.timeSeries.labels;
            this.charts.revenue.data.datasets[0].data = data.revenue.timeSeries.values;
            this.charts.revenue.update('none');
        }

        // Update efficiency chart
        if (this.charts.efficiency && data.efficiency?.timeSeries) {
            this.charts.efficiency.data.labels = data.efficiency.timeSeries.labels;
            this.charts.efficiency.data.datasets[0].data = data.efficiency.timeSeries.values;
            this.charts.efficiency.update('none');
        }

        // Update retention chart
        if (this.charts.retention && data.retention?.timeSeries) {
            this.charts.retention.data.labels = data.retention.timeSeries.labels;
            this.charts.retention.data.datasets[0].data = data.retention.timeSeries.values;
            this.charts.retention.update('none');
        }
    }

    startRealTimeUpdates() {
        // Real-time KPI updates every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (!document.hidden) {
                this.refreshKPIData();
            }
        }, 30000);

        // Market intelligence updates every 5 minutes
        setInterval(() => {
            if (!document.hidden) {
                this.refreshMarketIntelligence();
            }
        }, 300000);
    }

    async refreshKPIData() {
        try {
            await this.loadKPIData();
            this.performanceMetrics.lastUpdate = Date.now();
        } catch (error) {
            console.error('Failed to refresh KPI data:', error);
        }
    }

    async refreshMarketIntelligence() {
        try {
            await this.loadMarketIntelligence();
        } catch (error) {
            console.error('Failed to refresh market intelligence:', error);
        }
    }

    handleRealTimeMetricsUpdate(data) {
        console.log('📊 Real-time metrics update received:', data);

        // Update displays with animation
        this.animateValueUpdate('.kpi-value', data.value, data.previousValue);

        // Update charts
        this.addRealTimeDataPoint(data);

        // Show notification for significant changes
        if (data.significance === 'high') {
            this.showSignificantChangeNotification(data);
        }
    }

    handleCriticalAlert(alert) {
        console.log('🚨 Critical alert received:', alert);

        // Add alert to the alerts panel
        this.addExecutiveAlert(alert);

        // Play notification sound (optional)
        if (alert.priority === 'critical') {
            this.playNotificationSound();
        }

        // Browser notification if permission granted
        this.showBrowserNotification(alert);
    }

    addExecutiveAlert(alert) {
        const alertsContainer = document.querySelector('.executive-alerts');
        if (!alertsContainer) return;

        const alertElement = document.createElement('div');
        alertElement.className = `alert-item ${alert.type}`;
        alertElement.innerHTML = `
            <div class="alert-icon">${this.getAlertIcon(alert.type)}</div>
            <div class="alert-content">
                <span class="alert-title">${alert.title}</span>
                <span class="alert-desc">${alert.description}</span>
            </div>
            <button class="alert-action" data-alert-id="${alert.id}">
                ${alert.actionText || 'Take Action'}
            </button>
        `;

        alertsContainer.insertBefore(alertElement, alertsContainer.firstChild);

        // Auto-remove after 30 seconds
        setTimeout(() => {
            if (alertElement.parentNode) {
                alertElement.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => alertElement.remove(), 300);
            }
        }, 30000);
    }

    getAlertIcon(type) {
        const icons = {
            critical: '🚨',
            warning: '⚠️',
            opportunity: '💡',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }

    async exportExecutiveReport() {
        try {
            console.log('📋 Generating executive report...');

            const reportData = {
                timeframe: this.timeframe,
                generatedAt: new Date().toISOString(),
                kpis: await this.loadKPIData(),
                pipeline: await this.loadPipelineHealth(),
                aiPerformance: await this.loadAIPerformanceMetrics(),
                marketIntel: await this.loadMarketIntelligence(),
                forecast: await this.loadPredictiveForecast(),
                roi: await this.loadROIAnalysis(),
                benchmarks: await this.loadBenchmarkData()
            };

            // Generate PDF report
            await this.generatePDFReport(reportData);

            console.log('✅ Executive report generated successfully');
        } catch (error) {
            console.error('❌ Failed to generate executive report:', error);
            this.showExportError();
        }
    }

    switchView(view) {
        // Update navigation
        document.querySelectorAll('.nav-pill').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`)?.classList.add('active');

        // Update view content
        this.currentView = view;

        // Load view-specific data
        this.loadViewData(view);
    }

    updateTimeframe(timeframe) {
        this.timeframe = timeframe;

        // Clear cache for timeframe-dependent data
        this.clearTimeframeDependentCache();

        // Reload data with new timeframe
        this.loadInitialData();
    }

    // Performance and utility methods
    initializePerformanceMonitoring() {
        // Monitor Core Web Vitals
        if ('web-vital' in window) {
            import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
                getCLS(console.log);
                getFID(console.log);
                getFCP(console.log);
                getLCP(console.log);
                getTTFB(console.log);
            });
        }
    }

    showPerformanceMetrics() {
        console.group('📈 Executive Dashboard Performance');
        console.log(`Load Time: ${Math.round(this.performanceMetrics.loadTime)}ms`);
        console.log(`Average API Response: ${this.getAverageAPIResponseTime()}ms`);
        console.log(`Cache Hit Rate: ${this.getCacheHitRate()}%`);
        console.groupEnd();
    }

    isCacheValid(key) {
        const cached = this.dataCache.get(key);
        if (!cached) return false;

        const now = Date.now();
        const cacheTime = cached.timestamp || 0;
        return (now - cacheTime) < this.cacheExpiry;
    }

    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 1
        }).format(value);
    }

    animateValueUpdate(selector, newValue, oldValue) {
        const element = document.querySelector(selector);
        if (!element) return;

        element.style.transform = 'scale(1.1)';
        element.style.transition = 'transform 0.2s ease-out';

        setTimeout(() => {
            element.textContent = newValue;
            element.style.transform = 'scale(1)';
        }, 100);
    }

    updateConnectionStatus(connected) {
        const indicator = document.querySelector('.pulse-dot');
        if (indicator) {
            indicator.classList.toggle('active', connected);
        }
    }

    pauseRealTimeUpdates() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }

    resumeRealTimeUpdates() {
        this.startRealTimeUpdates();
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + R: Refresh data
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            this.loadInitialData();
        }

        // Ctrl/Cmd + E: Export report
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            this.exportExecutiveReport();
        }
    }

    // Error handling methods
    showErrorState(error) {
        console.error('Executive Dashboard Error:', error);
        // Implementation for error UI
    }

    showKPIError() {
        // Show error state for KPI cards
    }

    showExportError() {
        // Show error notification for export failure
    }

    getAverageAPIResponseTime() {
        const times = this.performanceMetrics.apiResponseTimes;
        if (times.length === 0) return 0;

        const sum = times.reduce((acc, curr) => acc + curr.time, 0);
        return Math.round(sum / times.length);
    }

    getCacheHitRate() {
        // Calculate cache hit rate
        return 85; // Placeholder
    }

    clearTimeframeDependentCache() {
        const keysToDelete = [];
        for (const [key] of this.dataCache) {
            if (key.includes(this.timeframe)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.dataCache.delete(key));
    }

    logout() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
}

// Export for global access
window.ExecutiveDashboardController = ExecutiveDashboardController;