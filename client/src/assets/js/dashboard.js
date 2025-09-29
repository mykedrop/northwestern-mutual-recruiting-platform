class RecruitingDashboard {
    constructor() {
        this.candidates = [];
        this.filteredCandidates = [];
        this.currentView = 'table';
        this.charts = {};
        this.websocket = null;
        this.alertsPaused = false;
        
        this.initialize();
    }

    async initialize() {
        console.log('[Dashboard] Initializing Recruiting Intelligence Dashboard...');
        
        this.setupEventListeners();
        this.initializeWebSocket();
        await this.loadCandidates();
        this.updateStats();
        this.setupCharts();
        
        // Auto-refresh every 30 seconds
        setInterval(() => this.loadCandidates(), 30000);
        
        console.log('[Dashboard] Initialization complete');
    }

    setupEventListeners() {
        // View controls
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });

        // Search and filters
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.filterCandidates();
        });

        document.getElementById('category-filter').addEventListener('change', () => {
            this.filterCandidates();
        });

        document.getElementById('score-filter').addEventListener('change', () => {
            this.filterCandidates();
        });

        document.getElementById('risk-filter').addEventListener('change', () => {
            this.filterCandidates();
        });

        // Alert controls
        document.getElementById('clear-alerts').addEventListener('click', () => {
            this.clearAlerts();
        });

        document.getElementById('pause-alerts').addEventListener('click', () => {
            this.toggleAlerts();
        });

        // Modal close
        document.getElementById('modal-close').addEventListener('click', () => {
            this.closeModal();
        });

        // Close modal on overlay click
        document.getElementById('candidate-modal').addEventListener('click', (e) => {
            if (e.target.id === 'candidate-modal') {
                this.closeModal();
            }
        });

        // Event delegation for action buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-btn') && e.target.dataset.candidateId) {
                this.viewCandidate(e.target.dataset.candidateId);
            } else if (e.target.classList.contains('flag-btn') && e.target.dataset.candidateId) {
                this.flagCandidate(e.target.dataset.candidateId);
            } else if (e.target.classList.contains('card-btn') && e.target.dataset.candidateId) {
                if (e.target.classList.contains('primary')) {
                    this.viewCandidate(e.target.dataset.candidateId);
                } else if (e.target.classList.contains('secondary')) {
                    this.flagCandidate(e.target.dataset.candidateId);
                }
            } else if (e.target.classList.contains('alert-close')) {
                e.target.parentElement.remove();
            }
        });
    }

    initializeWebSocket() {
        try {
            const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
            this.websocket = new WebSocket(`${protocol}//${location.host}/ws`);
            
            this.websocket.onopen = () => {
                console.log('[Dashboard] WebSocket connected');
                document.querySelector('.indicator-dot').classList.add('active');
            };
            
            this.websocket.onclose = () => {
                console.log('[Dashboard] WebSocket disconnected');
                document.querySelector('.indicator-dot').classList.remove('active');
            };
            
            this.websocket.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.handleWebSocketMessage(message);
            };
            
        } catch (error) {
            console.warn('[Dashboard] WebSocket initialization failed:', error);
        }
    }

    handleWebSocketMessage(message) {
        switch (message.type) {
            case 'assessment_completed':
                this.handleAssessmentCompleted(message.data);
                break;
            case 'cheat_detected':
                this.handleCheatDetected(message.data);
                break;
            case 'behavioral_alert':
                this.handleBehavioralAlert(message.data);
                break;
            case 'real_time_update':
                this.handleRealTimeUpdate(message.data);
                break;
        }
    }

    async loadCandidates() {
        try {
            this.showLoading();
            
            const response = await fetch('/api/candidates/assessments');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.candidates = data.candidates || [];
            
            console.log('[Dashboard] Loaded', this.candidates.length, 'candidates');
            
            this.filterCandidates();
            this.updateStats();
            this.updateCharts();
            
        } catch (error) {
            console.error('[Dashboard] Failed to load candidates:', error);
            this.showError('Failed to load candidate data');
        } finally {
            this.hideLoading();
        }
    }

    filterCandidates() {
        const searchTerm = document.getElementById('search-input').value.toLowerCase();
        const categoryFilter = document.getElementById('category-filter').value;
        const scoreFilter = document.getElementById('score-filter').value;
        const riskFilter = document.getElementById('risk-filter').value;

        this.filteredCandidates = this.candidates.filter(candidate => {
            // Search filter
            if (searchTerm && !this.matchesSearch(candidate, searchTerm)) {
                return false;
            }

            // Category filter
            if (categoryFilter && !this.matchesCategory(candidate, categoryFilter)) {
                return false;
            }

            // Score filter
            if (scoreFilter && !this.matchesScore(candidate, scoreFilter)) {
                return false;
            }

            // Risk filter
            if (riskFilter && !this.matchesRisk(candidate, riskFilter)) {
                return false;
            }

            return true;
        });

        this.renderCandidates();
    }

    matchesSearch(candidate, searchTerm) {
        const searchableText = [
            candidate.first_name || '',
            candidate.last_name || '',
            candidate.email || '',
            candidate.id || ''
        ].join(' ').toLowerCase();
        
        return searchableText.includes(searchTerm);
    }

    matchesCategory(candidate, category) {
        if (!candidate.finalAnalysis?.categoryScores) return false;
        return candidate.finalAnalysis.categoryScores[category] !== undefined;
    }

    matchesScore(candidate, scoreFilter) {
        const overallScore = this.calculateOverallScore(candidate);
        
        switch (scoreFilter) {
            case 'high': return overallScore >= 80;
            case 'medium': return overallScore >= 60 && overallScore < 80;
            case 'low': return overallScore < 60;
            default: return true;
        }
    }

    matchesRisk(candidate, riskFilter) {
        const riskLevel = this.calculateRiskLevel(candidate);
        return riskLevel === riskFilter;
    }

    calculateOverallScore(candidate) {
        if (!candidate.finalAnalysis?.dimensionalProfile) return 0;
        
        const dimensions = candidate.finalAnalysis.dimensionalProfile;
        const scores = Object.values(dimensions);
        return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
    }

    calculateRiskLevel(candidate) {
        const authenticityScore = candidate.finalAnalysis?.authenticityScore || 100;
        const redFlags = candidate.finalAnalysis?.redFlags || [];
        const cheatFlags = candidate.cheatDetectionFlags || [];
        
        if (authenticityScore < 50 || redFlags.length > 2 || cheatFlags.length > 1) {
            return 'high';
        } else if (authenticityScore < 75 || redFlags.length > 0 || cheatFlags.length > 0) {
            return 'medium';
        } else {
            return 'low';
        }
    }

    renderCandidates() {
        if (this.currentView === 'table') {
            this.renderTableView();
        } else if (this.currentView === 'cards') {
            this.renderCardView();
        }
    }

    renderTableView() {
        const tbody = document.getElementById('candidates-tbody');
        
        if (this.filteredCandidates.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">
                        <div class="no-data-content">
                            <div class="no-data-icon">📊</div>
                            <h3>No candidates match your filters</h3>
                            <p>Try adjusting your search criteria or view all candidates</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = this.filteredCandidates.map(candidate => `
            <tr class="candidate-row" data-candidate-id="${candidate.id}">
                <td class="candidate-info">
                    <div class="candidate-name">${candidate.first_name || 'Unknown'} ${candidate.last_name || 'Candidate'}</div>
                    <div class="candidate-email">${candidate.email || 'No email'}</div>
                    <div class="candidate-id">ID: ${candidate.id}</div>
                </td>
                <td class="profile-preview">
                    <div class="mini-radar" data-candidate-id="${candidate.id}">
                        <canvas width="80" height="80"></canvas>
                    </div>
                </td>
                <td class="overall-score">
                    <span class="score-value">${this.calculateOverallScore(candidate)}</span>
                    <span class="score-max">/100</span>
                </td>
                <td class="consistency">
                    <span class="consistency-score">${candidate.finalAnalysis?.consistencyScore || 'N/A'}%</span>
                </td>
                <td class="risk-level">
                    <span class="risk-badge risk-${this.calculateRiskLevel(candidate)}">
                        ${this.calculateRiskLevel(candidate).toUpperCase()}
                    </span>
                </td>
                <td class="completion-time">
                    ${this.formatCompletionTime(candidate)}
                </td>
                <td class="actions">
                    <button class="action-btn view-btn" data-candidate-id="${candidate.id}">
                        View Report
                    </button>
                    <button class="action-btn flag-btn" data-candidate-id="${candidate.id}">
                        Flag
                    </button>
                </td>
            </tr>
        `).join('');

        // Render mini radar charts
        this.renderMiniRadarCharts();
    }

    renderCardView() {
        const cardsContainer = document.getElementById('candidate-cards');
        
        if (this.filteredCandidates.length === 0) {
            cardsContainer.innerHTML = `
                <div class="no-data">
                    <div class="no-data-icon">📊</div>
                    <h3>No candidates match your filters</h3>
                    <p>Try adjusting your search criteria or view all candidates</p>
                </div>
            `;
            return;
        }

        cardsContainer.innerHTML = this.filteredCandidates.map(candidate => `
            <div class="candidate-card" data-candidate-id="${candidate.id}">
                <div class="card-header">
                    <div class="candidate-avatar">
                        ${(candidate.first_name?.[0] || 'C')}${(candidate.last_name?.[0] || 'A')}
                    </div>
                    <div class="candidate-basic-info">
                        <h3 class="candidate-name">${candidate.first_name || 'Unknown'} ${candidate.last_name || 'Candidate'}</h3>
                        <p class="candidate-email">${candidate.email || 'No email'}</p>
                    </div>
                    <div class="risk-indicator risk-${this.calculateRiskLevel(candidate)}">
                        ${this.calculateRiskLevel(candidate).toUpperCase()}
                    </div>
                </div>
                
                <div class="card-body">
                    <div class="score-summary">
                        <div class="overall-score">
                            <span class="score-number">${this.calculateOverallScore(candidate)}</span>
                            <span class="score-label">Overall</span>
                        </div>
                        <div class="consistency-score">
                            <span class="score-number">${candidate.finalAnalysis?.consistencyScore || 'N/A'}</span>
                            <span class="score-label">Consistency</span>
                        </div>
                    </div>
                    
                    <div class="dimensional-preview">
                        <h4>5-Dimensional Profile</h4>
                        <div class="dimension-grid">
                            ${this.renderDimensionPreview(candidate)}
                        </div>
                    </div>
                </div>
                
                <div class="card-footer">
                    <button class="card-btn primary" data-candidate-id="${candidate.id}">
                        Full Report
                    </button>
                    <button class="card-btn secondary" data-candidate-id="${candidate.id}">
                        Flag Issues
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderDimensionPreview(candidate) {
        if (!candidate.finalAnalysis?.dimensionalProfile) {
            return '<p>No dimensional data available</p>';
        }

        const dimensions = candidate.finalAnalysis.dimensionalProfile;
        const topDimensions = Object.entries(dimensions)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6);

        return topDimensions.map(([dimension, score]) => `
            <div class="dimension-item">
                <span class="dimension-name">${this.formatDimensionName(dimension)}</span>
                <span class="dimension-score">${score}</span>
            </div>
        `).join('');
    }

    formatDimensionName(dimension) {
        return dimension
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    switchView(view) {
        this.currentView = view;
        
        // Update button states
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // Show/hide view containers
        document.querySelectorAll('.view-container').forEach(container => {
            container.style.display = 'none';
        });
        
        document.getElementById(`${view}-view`).style.display = 'block';
        
        // Render appropriate view
        this.renderCandidates();
        
        // Update charts if switching to analytics
        if (view === 'analytics') {
            this.updateCharts();
        }
    }

    async viewCandidate(candidateId) {
        try {
            const response = await fetch(`/api/candidates/${candidateId}/detailed`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const candidate = await response.json();
            this.showCandidateModal(candidate);
            
        } catch (error) {
            console.error('[Dashboard] Failed to load candidate details:', error);
            alert('Failed to load candidate details');
        }
    }

    showCandidateModal(candidate) {
        const modal = document.getElementById('candidate-modal');
        const content = document.getElementById('modal-content');
        
        content.innerHTML = this.generateCandidateReport(candidate);
        modal.style.display = 'flex';
        
        // Initialize modal charts
        this.initializeModalCharts(candidate);
    }

    generateCandidateReport(candidate) {
        // Handle old assessment data that doesn't have finalAnalysis
        const dimensionalScores = candidate.finalAnalysis?.dimensionalScores || {};
        const behavioralProfile = candidate.finalAnalysis?.behavioralProfile || {};
        const consistencyScore = candidate.finalAnalysis?.consistencyScore || candidate.authenticity_score || 0;
        const recommendations = candidate.finalAnalysis?.recommendations || [];
        
        // If no dimensional scores, create placeholder data
        const hasDimensionalData = Object.keys(dimensionalScores).length > 0;
        
        return `
            <div class="candidate-report">
                <!-- Header Section -->
                <div class="report-header">
                    <div class="candidate-profile">
                        <div class="profile-avatar">
                            ${(candidate.first_name?.[0] || 'C')}${(candidate.last_name?.[0] || 'A')}
                        </div>
                        <div class="profile-info">
                            <h3>${candidate.first_name || 'Unknown'} ${candidate.last_name || 'Candidate'}</h3>
                            <p class="candidate-email">${candidate.email || 'No email'}</p>
                            <p class="assessment-date">Assessment completed: ${this.formatDate(candidate.completed_at)}</p>
                        </div>
                    </div>
                    <div class="overall-metrics">
                        <div class="metric">
                            <span class="metric-value">${this.calculateOverallScore(candidate)}</span>
                            <span class="metric-label">Overall Score</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">${consistencyScore}%</span>
                            <span class="metric-label">Consistency</span>
                        </div>
                        <div class="metric">
                            <span class="metric-value">${this.calculateRiskLevel(candidate).toUpperCase()}</span>
                            <span class="metric-label">Risk Level</span>
                        </div>
                    </div>
                </div>

                ${hasDimensionalData ? `
                <!-- 5-Dimensional Profile -->
                <div class="report-section">
                    <h3>🎯 5-Dimensional Behavioral Profile</h3>
                    <div class="radar-chart-container">
                        <canvas id="modal-radar-chart" width="400" height="400"></canvas>
                    </div>
                    <div class="dimension-breakdown">
                        ${this.generateDimensionBreakdown(dimensionalScores)}
                    </div>
                </div>

                <!-- Behavioral Analysis -->
                <div class="report-section">
                    <h3>🧠 Behavioral Intelligence Analysis</h3>
                    <div class="behavioral-analysis">
                        ${this.generateBehavioralAnalysis(behavioralProfile, consistencyScore)}
                    </div>
                </div>

                <!-- Development Areas -->
                <div class="report-section">
                    <h3>💡 Development Recommendations</h3>
                    <div class="recommendations">
                        ${this.generateRecommendations(recommendations)}
                    </div>
                </div>
                ` : `
                <!-- Legacy Assessment Data -->
                <div class="report-section">
                    <h3>📊 Assessment Summary</h3>
                    <div class="legacy-data">
                        <p><strong>Assessment Score:</strong> ${candidate.assessment_score || 'N/A'}</p>
                        <p><strong>Tier Classification:</strong> ${candidate.tier || 'N/A'}</p>
                        <p><strong>Authenticity Score:</strong> ${candidate.authenticity_score || 'N/A'}%</p>
                        <p><strong>Completion Time:</strong> ${this.formatCompletionTime(candidate)}</p>
                        <p><em>This assessment was completed using the previous system. New assessments will include detailed 5-dimensional behavioral analysis.</em></p>
                    </div>
                </div>
                `}
            </div>
        `;
    }

    generateDimensionBreakdown(dimensionalScores) {
        if (!dimensionalScores || Object.keys(dimensionalScores).length === 0) {
            return '<p>No dimensional data available</p>';
        }

        const dimensionNames = {
            'client_advocacy': 'Client Advocacy',
            'ethical_flexibility': 'Ethical Flexibility', 
            'emotional_durability': 'Emotional Durability',
            'strategic_thinking': 'Strategic Thinking',
            'social_intelligence': 'Social Intelligence'
        };

        return Object.entries(dimensionalScores).map(([dimension, data]) => `
            <div class="dimension-item">
                <div class="dimension-header">
                    <span class="dimension-name">${dimensionNames[dimension] || dimension}</span>
                    <span class="dimension-score">${data.percentage || 0}%</span>
                </div>
                <div class="dimension-bar">
                    <div class="dimension-fill" style="width: ${data.percentage || 0}%"></div>
                </div>
                <div class="dimension-weight">Weight: ${Math.round((data.weight || 0) * 100)}%</div>
            </div>
        `).join('');
    }

    generateBehavioralAnalysis(behavioralProfile, consistencyScore) {
        if (!behavioralProfile || Object.keys(behavioralProfile).length === 0) {
            return '<p>No behavioral analysis data available</p>';
        }

        return `
            <div class="behavioral-metrics">
                <div class="metric-card">
                    <h4>Response Consistency</h4>
                    <div class="metric-value">${consistencyScore}%</div>
                    <p>Indicates genuine engagement and thoughtful responses</p>
                </div>
                <div class="behavioral-patterns">
                    <h4>Key Behavioral Patterns</h4>
                    <ul>
                        ${Object.entries(behavioralProfile).map(([pattern, value]) => 
                            `<li><strong>${pattern.replace(/_/g, ' ').toUpperCase()}:</strong> ${value}</li>`
                        ).join('')}
                    </ul>
                </div>
            </div>
        `;
    }

    generateCategoryScores(categoryScores) {
        const categoryNames = {
            personality_assessment: 'Personality Assessment',
            business_acumen: 'Business Acumen',
            integrity_ethics: 'Integrity & Ethics',
            communication_skills: 'Communication Skills',
            problem_solving: 'Problem Solving',
            stress_resilience: 'Stress Resilience'
        };

        return Object.entries(categoryScores).map(([category, data]) => `
            <div class="category-score">
                <div class="category-header">
                    <span class="category-name">${categoryNames[category] || category}</span>
                    <span class="category-score-value">${Math.round(data.average * 20)}/100</span>
                </div>
                <div class="category-bar">
                    <div class="category-fill" style="width: ${data.percentage}%"></div>
                </div>
                <div class="category-details">
                    <span>Questions: ${data.count}</span>
                    <span>Raw Score: ${data.total}</span>
                </div>
            </div>
        `).join('');
    }

    generateBehavioralInsights(insights) {
        if (!insights || Object.keys(insights).length === 0) {
            return '<p>No behavioral data available</p>';
        }

        return `
            <div class="insights-grid">
                <div class="insight-item">
                    <h4>Response Patterns</h4>
                    <p>${insights.responsePatterns || 'No pattern analysis available'}</p>
                </div>
                <div class="insight-item">
                    <h4>Time Analysis</h4>
                    <p>${insights.timeAnalysis || 'No time analysis available'}</p>
                </div>
                <div class="insight-item">
                    <h4>Behavioral Markers</h4>
                    <p>${insights.behavioralMarkers || 'No behavioral markers available'}</p>
                </div>
            </div>
        `;
    }

    generateRecommendations(recommendations) {
        if (!recommendations || recommendations.length === 0) {
            return '<p>No specific recommendations available</p>';
        }

        return `
            <div class="recommendations-list">
                ${recommendations.map(rec => `
                    <div class="recommendation-item priority-${rec.priority}">
                        <div class="recommendation-header">
                            <span class="priority-badge priority-${rec.priority}">${rec.priority.toUpperCase()}</span>
                            <span class="dimension-name">${this.formatDimensionName(rec.dimension)}</span>
                            <span class="dimension-score">${rec.score}/100</span>
                        </div>
                        <p class="recommendation-text">${rec.recommendation}</p>
                    </div>
                `).join('')}
            </div>
        `;
    }

    generateRiskAnalysis(candidate) {
        const riskLevel = this.calculateRiskLevel(candidate);
        const cheatFlags = candidate.cheatDetectionFlags || [];
        const redFlags = candidate.finalAnalysis?.redFlags || [];
        
        return `
            <div class="risk-summary">
                <div class="risk-level-display risk-${riskLevel}">
                    <h4>Overall Risk: ${riskLevel.toUpperCase()}</h4>
                    <p>${this.getRiskDescription(riskLevel)}</p>
                </div>
                
                <div class="risk-details">
                    <div class="risk-category">
                        <h5>Cheat Detection Flags</h5>
                        <ul>
                            ${cheatFlags.length > 0 ? 
                                cheatFlags.map(flag => `<li>${flag.type}: ${flag.description}</li>`).join('') :
                                '<li>No cheat detection flags</li>'
                            }
                        </ul>
                    </div>
                    
                    <div class="risk-category">
                        <h5>Behavioral Red Flags</h5>
                        <ul>
                            ${redFlags.length > 0 ? 
                                redFlags.map(flag => `<li>${flag.type}: ${flag.description}</li>`).join('') :
                                '<li>No behavioral red flags</li>'
                            }
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    getRiskDescription(riskLevel) {
        switch (riskLevel) {
            case 'low':
                return 'Candidate shows low risk indicators and high authenticity scores.';
            case 'medium':
                return 'Some concerns detected. Recommend additional review and interview focus.';
            case 'high':
                return 'Multiple risk indicators detected. Strongly recommend detailed investigation.';
            default:
                return 'Risk level could not be determined.';
        }
    }

    closeModal() {
        document.getElementById('candidate-modal').style.display = 'none';
    }

    updateStats() {
        const totalCandidates = this.candidates.length;
        const completedAssessments = this.candidates.filter(c => c.completed_at).length;
        const highPotential = this.candidates.filter(c => this.calculateOverallScore(c) >= 80).length;
        const redFlags = this.candidates.filter(c => this.calculateRiskLevel(c) === 'high').length;

        document.getElementById('total-candidates').textContent = totalCandidates;
        document.getElementById('completed-assessments').textContent = completedAssessments;
        document.getElementById('high-potential').textContent = highPotential;
        document.getElementById('red-flags').textContent = redFlags;
    }

    setupCharts() {
        // Initialize Chart.js charts for analytics view
        if (typeof Chart === 'undefined') {
            console.warn('[Dashboard] Chart.js not loaded, skipping chart initialization');
            return;
        }
        
        this.charts.radar = this.createRadarChart();
        this.charts.score = this.createScoreChart();
        this.charts.risk = this.createRiskChart();
        this.charts.time = this.createTimeChart();
    }

    createRadarChart() {
        const ctx = document.getElementById('radar-chart');
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'radar',
            data: {
                labels: [
                    'Client Advocacy', 'Ethical Flexibility', 'Emotional Durability',
                    'Strategic Thinking', 'Social Intelligence'
                ],
                datasets: [{
                    label: 'Average Scores',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2,
                    pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(59, 130, 246, 1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            stepSize: 20
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    }
                }
            }
        });
    }

    createScoreChart() {
        const ctx = document.getElementById('score-chart');
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['0-19', '20-39', '40-59', '60-79', '80-100'],
                datasets: [{
                    label: 'Candidates',
                    data: [0, 0, 0, 0, 0],
                    backgroundColor: [
                        'rgba(239, 68, 68, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(59, 130, 246, 0.8)',
                        'rgba(16, 185, 129, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createRiskChart() {
        const ctx = document.getElementById('risk-chart');
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Low Risk', 'Medium Risk', 'High Risk'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: [
                        'rgba(16, 185, 129, 0.8)',
                        'rgba(245, 158, 11, 0.8)',
                        'rgba(239, 68, 68, 0.8)'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    createTimeChart() {
        const ctx = document.getElementById('time-chart');
        if (!ctx) return null;

        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Completion Time (minutes)',
                    data: [],
                    borderColor: 'rgba(59, 130, 246, 1)',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Minutes'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Assessment Date'
                        }
                    }
                }
            }
        });
    }

    updateCharts() {
        if (this.currentView !== 'analytics') return;

        this.updateRadarChart();
        this.updateScoreChart();
        this.updateRiskChart();
        this.updateTimeChart();
    }

    updateRadarChart() {
        if (!this.charts.radar) return;

        const averageScores = this.calculateAverageDimensionalScores();
        this.charts.radar.data.datasets[0].data = Object.values(averageScores);
        this.charts.radar.update();
    }

    updateScoreChart() {
        if (!this.charts.score) return;

        const scoreDistribution = this.calculateScoreDistribution();
        this.charts.score.data.datasets[0].data = scoreDistribution;
        this.charts.score.update();
    }

    updateRiskChart() {
        if (!this.charts.risk) return;

        const riskDistribution = this.calculateRiskDistribution();
        this.charts.risk.data.datasets[0].data = riskDistribution;
        this.charts.risk.update();
    }

    updateTimeChart() {
        if (!this.charts.time) return;

        const timeData = this.calculateTimeTrends();
        this.charts.time.data.labels = timeData.labels;
        this.charts.time.data.datasets[0].data = timeData.values;
        this.charts.time.update();
    }

    calculateAverageDimensionalScores() {
        const dimensions = [
            'sales_aptitude', 'client_empathy', 'integrity_quotient', 'learning_agility',
            'stress_resilience', 'communication_clarity', 'long_term_orientation',
            'leadership_potential', 'cultural_alignment', 'adaptability_index',
            'business_acumen', 'retention_probability'
        ];

        const averages = {};
        dimensions.forEach(dimension => {
            const scores = this.candidates
                .filter(c => c.finalAnalysis?.dimensionalProfile?.[dimension])
                .map(c => c.finalAnalysis.dimensionalProfile[dimension]);
            
            averages[dimension] = scores.length > 0 ? 
                Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : 0;
        });

        return averages;
    }

    calculateScoreDistribution() {
        const distribution = [0, 0, 0, 0, 0]; // 0-19, 20-39, 40-59, 60-79, 80-100
        
        this.candidates.forEach(candidate => {
            const score = this.calculateOverallScore(candidate);
            if (score < 20) distribution[0]++;
            else if (score < 40) distribution[1]++;
            else if (score < 60) distribution[2]++;
            else if (score < 80) distribution[3]++;
            else distribution[4]++;
        });

        return distribution;
    }

    calculateRiskDistribution() {
        const distribution = [0, 0, 0]; // Low, Medium, High
        
        this.candidates.forEach(candidate => {
            const riskLevel = this.calculateRiskLevel(candidate);
            if (riskLevel === 'low') distribution[0]++;
            else if (riskLevel === 'medium') distribution[1]++;
            else distribution[2]++;
        });

        return distribution;
    }

    calculateTimeTrends() {
        const timeData = this.candidates
            .filter(c => c.finalAnalysis?.completionTime)
            .sort((a, b) => new Date(a.completed_at) - new Date(b.completed_at))
            .slice(-10); // Last 10 assessments

        return {
            labels: timeData.map(c => this.formatDate(c.completed_at)),
            values: timeData.map(c => Math.round(c.finalAnalysis.completionTime / 1000 / 60))
        };
    }

    renderMiniRadarCharts() {
        // Render mini radar charts for table view
        this.filteredCandidates.forEach(candidate => {
            if (candidate.finalAnalysis?.dimensionalProfile) {
                this.renderMiniRadarChart(candidate);
            }
        });
    }

    renderMiniRadarChart(candidate) {
        const canvas = document.querySelector(`[data-candidate-id="${candidate.id}"] canvas`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const dimensions = candidate.finalAnalysis.dimensionalProfile;
        
        // Create mini radar chart
        this.drawMiniRadar(ctx, Object.values(dimensions));
    }

    drawMiniRadar(ctx, scores) {
        const centerX = 40;
        const centerY = 40;
        const radius = 30;
        
        ctx.clearRect(0, 0, 80, 80);
        
        // Draw radar grid
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        
        for (let i = 1; i <= 4; i++) {
            const r = (radius * i) / 4;
            ctx.beginPath();
            for (let j = 0; j < 12; j++) {
                const angle = (j * Math.PI * 2) / 12 - Math.PI / 2;
                const x = centerX + r * Math.cos(angle);
                const y = centerY + r * Math.sin(angle);
                
                if (j === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
        }
        
        // Draw scores
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        
        ctx.beginPath();
        scores.forEach((score, i) => {
            const angle = (i * Math.PI * 2) / 12 - Math.PI / 2;
            const r = (radius * score) / 100;
            const x = centerX + r * Math.cos(angle);
            const y = centerY + r * Math.sin(angle);
            
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    formatDate(dateString) {
        if (!dateString) return 'N/A';
        return new Date(dateString).toLocaleDateString();
    }

    formatCompletionTime(candidate) {
        if (!candidate.finalAnalysis?.completionTime) return 'N/A';
        const minutes = Math.round(candidate.finalAnalysis.completionTime / 1000 / 60);
        return `${minutes}m`;
    }

    showLoading() {
        document.getElementById('loading-state').style.display = 'flex';
        document.getElementById('empty-state').style.display = 'none';
    }

    hideLoading() {
        document.getElementById('loading-state').style.display = 'none';
    }

    showError(message) {
        // Show error message to user
        console.error('[Dashboard] Error:', message);
    }

    handleAssessmentCompleted(data) {
        console.log('[Dashboard] Assessment completed:', data);
        this.addAlert('assessment_completed', `New assessment completed by ${data.candidateName}`);
        this.loadCandidates(); // Refresh data
    }

    handleCheatDetected(data) {
        console.log('[Dashboard] Cheat detected:', data);
        this.addAlert('cheat_detected', `Cheat detection alert: ${data.description}`);
    }

    handleBehavioralAlert(data) {
        console.log('[Dashboard] Behavioral alert:', data);
        this.addAlert('behavioral_alert', `Behavioral alert: ${data.description}`);
    }

    handleRealTimeUpdate(data) {
        console.log('[Dashboard] Real-time update:', data);
        // Handle real-time updates
    }

    addAlert(type, message) {
        if (this.alertsPaused) return;

        const alertsContainer = document.getElementById('alerts-container');
        const alertElement = document.createElement('div');
        alertElement.className = `alert alert-${type}`;
        alertElement.innerHTML = `
            <div class="alert-content">
                <span class="alert-icon">${this.getAlertIcon(type)}</span>
                <span class="alert-message">${message}</span>
                <span class="alert-time">${new Date().toLocaleTimeString()}</span>
            </div>
                                    <button class="alert-close">&times;</button>
        `;

        alertsContainer.appendChild(alertElement);
        
        // Remove old alerts if too many
        const alerts = alertsContainer.querySelectorAll('.alert');
        if (alerts.length > 10) {
            alerts[0].remove();
        }
    }

    getAlertIcon(type) {
        const icons = {
            assessment_completed: '✅',
            cheat_detected: '🚨',
            behavioral_alert: '🧠'
        };
        return icons[type] || 'ℹ️';
    }

    clearAlerts() {
        const alertsContainer = document.getElementById('alerts-container');
        alertsContainer.innerHTML = '<div class="no-alerts">No active alerts</div>';
    }

    toggleAlerts() {
        this.alertsPaused = !this.alertsPaused;
        const button = document.getElementById('pause-alerts');
        button.textContent = this.alertsPaused ? 'Resume' : 'Pause';
        button.classList.toggle('paused', this.alertsPaused);
    }

    flagCandidate(candidateId) {
        // Implement candidate flagging functionality
        console.log('[Dashboard] Flagging candidate:', candidateId);
        alert('Candidate flagging functionality coming soon!');
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Dashboard] Initializing...');
    window.dashboard = new RecruitingDashboard();
});
