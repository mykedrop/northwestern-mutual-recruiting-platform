// Dashboard JavaScript
class Dashboard {
    constructor() {
        this.apiClient = new APIClient();
        this.socket = null;
        this.currentView = 'overview';
        this.candidates = [];
        this.selectedCandidates = new Set();
        
        this.init();
    }
    
    async init() {
        // Check authentication
        const token = localStorage.getItem('accessToken');
        if (!token) {
            window.location.href = '/login.html';
            return;
        }
        
        // Initialize WebSocket
        this.initWebSocket();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Listen for candidate import events
        window.addEventListener('candidateImported', (event) => {
            console.log('Candidate imported event received:', event.detail);
            this.handleCandidateImported(event.detail);
        });
        
        // Listen for view changes
        window.addEventListener('viewChanged', (event) => {
            console.log('View changed event received:', event.detail);
        });
        
        // Integrate with state manager
        if (window.stateManager) {
            this.integrateWithStateManager();
        }
        
        // Load initial data
        await this.loadDashboardData();
        
        // Set user info
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        document.getElementById('user-name').textContent = `${user.firstName} ${user.lastName}`;
    }
    
    initWebSocket() {
        this.socket = io('http://localhost:3001', {
            transports: ['websocket'],
            auth: {
                token: localStorage.getItem('accessToken')
            }
        });
        
        this.socket.on('connect', () => {
            console.log('WebSocket connected');
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            this.socket.emit('join-dashboard', user.id);
        });
        
        this.socket.on('candidate-progress', (data) => {
            this.handleCandidateProgress(data);
        });
        
        this.socket.on('assessment-completed', (data) => {
            this.handleAssessmentCompleted(data);
        });
    }
    
    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchView(e.target.dataset.view);
            });
        });
        
        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.logout();
        });
        
        // Search and filters
        document.getElementById('search-input')?.addEventListener('input', (e) => {
            this.filterCandidates(e.target.value);
        });
        
        document.getElementById('status-filter')?.addEventListener('change', (e) => {
            this.filterByStatus(e.target.value);
        });
        
        // Export
        document.getElementById('export-csv-btn')?.addEventListener('click', () => {
            this.exportCSV();
        });
        
        // Analytics filters
        document.getElementById('apply-filters-btn')?.addEventListener('click', () => {
            this.applyAnalyticsFilters();
        });
        
        // Compare
        document.getElementById('compare-btn')?.addEventListener('click', () => {
            this.compareCandidates();
        });
        
        // Modal close
        document.querySelector('.close-modal')?.addEventListener('click', () => {
            this.closeModal();
        });
    }
    
    async loadDashboardData() {
        try {
            const overview = await this.apiClient.get('/dashboard/overview');
            this.updateOverview(overview);
            
            if (this.currentView === 'candidates') {
                await this.loadCandidates();
            } else if (this.currentView === 'analytics') {
                await this.loadAnalytics();
            }
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        }
    }
    
    updateOverview(data) {
        // Update stats
        document.getElementById('total-candidates').textContent = data.stats.total_candidates;
        document.getElementById('completed-assessments').textContent = data.stats.completed_assessments;
        document.getElementById('in-progress').textContent = data.stats.in_progress;
        document.getElementById('today-candidates').textContent = data.stats.today_candidates;
        
        // Update recent candidates
        const recentList = document.getElementById('recent-candidates-list');
        recentList.innerHTML = '';
        
        data.recentCandidates.forEach(candidate => {
            const card = this.createCandidateCard(candidate);
            recentList.appendChild(card);
        });
        
        // Update notifications
        const notificationsList = document.getElementById('notifications-list');
        notificationsList.innerHTML = '';
        
        data.notifications.forEach(notification => {
            const notifElement = this.createNotification(notification);
            notificationsList.appendChild(notifElement);
        });
    }
    
    createCandidateCard(candidate) {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.innerHTML = `
            <div class="candidate-info">
                <div class="candidate-name">${candidate.first_name} ${candidate.last_name}</div>
                <div class="candidate-email">${candidate.email}</div>
            </div>
            <div class="candidate-status status-${candidate.assessment_status || 'not-started'}">
                ${candidate.assessment_status || 'Not Started'}
            </div>
            <div class="candidate-progress">
                ${candidate.completion_percentage || 0}%
            </div>
        `;
        
        card.addEventListener('click', () => {
            this.showCandidateDetail(candidate.id);
        });
        
        return card;
    }
    
    createNotification(notification) {
        const notif = document.createElement('div');
        notif.className = 'notification-item';
        notif.innerHTML = `
            <div class="notification-title">${notification.title}</div>
            <div class="notification-message">${notification.message}</div>
            <div class="notification-time">${new Date(notification.created_at).toLocaleString()}</div>
        `;
        return notif;
    }
    
    async loadCandidates(forceRefresh = false) {
        try {
            console.log('Loading candidates...', forceRefresh ? '(force refresh)' : '');
            
            // Show loading indicator
            this.showLoadingIndicator('candidates-table', 'Loading candidates...');
            
            const candidates = await this.apiClient.get('/dashboard/candidates');
            this.candidates = candidates;
            this.displayCandidates(candidates);
            this.setupCandidateCheckboxes(candidates);
            console.log(`Loaded ${candidates.length} candidates`);
            
            // Hide loading indicator
            this.hideLoadingIndicator('candidates-table');
            
        } catch (error) {
            console.error('Failed to load candidates:', error);
            this.hideLoadingIndicator('candidates-table');
            this.showNotification('Failed to load candidates: ' + error.message, 'error');
        }
    }
    
    displayCandidates(candidates) {
        const tableContainer = document.getElementById('candidates-table');
        
        if (candidates.length === 0) {
            tableContainer.innerHTML = '<p>No candidates found</p>';
            return;
        }
        
        const table = document.createElement('table');
        table.className = 'candidates-table';
        table.innerHTML = `
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Added</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${candidates.map(candidate => `
                    <tr>
                        <td>${candidate.first_name} ${candidate.last_name}</td>
                        <td>${candidate.email}</td>
                        <td><span class="candidate-status status-${candidate.assessment_status || 'not-started'}">
                            ${candidate.assessment_status || 'Not Started'}
                        </span></td>
                        <td>${candidate.completion_percentage || 0}%</td>
                        <td>${new Date(candidate.created_at).toLocaleDateString()}</td>
                        <td>
                            <button onclick="dashboard.showCandidateDetail('${candidate.id}')">View</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        `;
        
        tableContainer.innerHTML = '';
        tableContainer.appendChild(table);
    }
    
    setupCandidateCheckboxes(candidates) {
        const container = document.getElementById('candidate-checkboxes');
        if (!container) return;
        
        container.innerHTML = '';
        
        candidates.forEach(candidate => {
            const label = document.createElement('label');
            label.innerHTML = `
                <input type="checkbox" value="${candidate.id}" 
                       onchange="dashboard.toggleCandidateSelection('${candidate.id}')">
                ${candidate.first_name} ${candidate.last_name}
            `;
            container.appendChild(label);
        });
    }
    
    toggleCandidateSelection(candidateId) {
        if (this.selectedCandidates.has(candidateId)) {
            this.selectedCandidates.delete(candidateId);
        } else {
            this.selectedCandidates.add(candidateId);
        }
        
        const compareBtn = document.getElementById('compare-btn');
        compareBtn.disabled = this.selectedCandidates.size < 2;
    }
    
    async showCandidateDetail(candidateId) {
        try {
            const detail = await this.apiClient.get(`/dashboard/candidate/${candidateId}`);
            
            // Get intelligence report if assessment is complete
            let intelligenceHTML = '';
            console.log('Assessment status:', detail.assessment?.status);
            if (detail.assessment && detail.assessment.status === 'completed') {
                try {
                    console.log('Fetching intelligence report for assessment:', detail.assessment.id);
                    const intelligenceReport = await this.apiClient.get(`/assessment/intelligence/${detail.assessment.id}`);
                    console.log('Intelligence report received:', intelligenceReport);
                    intelligenceHTML = this.renderIntelligenceReport(intelligenceReport);
                    console.log('Generated HTML length:', intelligenceHTML.length);
                } catch (error) {
                    console.error('Error fetching intelligence report:', error);
                }
            } else {
                console.log('Assessment not completed, skipping intelligence report');
            }
            
            this.displayCandidateModal(detail, intelligenceHTML);
        } catch (error) {
            console.error('Failed to load candidate detail:', error);
        }
    }
    
    displayCandidateModal(data, intelligenceHTML) {
        const modal = document.getElementById('candidate-modal');
        const modalBody = document.getElementById('modal-body');
        
        console.log('Displaying modal with intelligence HTML length:', intelligenceHTML.length);
        console.log('Intelligence HTML preview:', intelligenceHTML.substring(0, 200));
        
        modalBody.innerHTML = `
            <h2>${data.candidate.first_name} ${data.candidate.last_name}</h2>
            <p>Email: ${data.candidate.email}</p>
            <p>Phone: ${data.candidate.phone || 'N/A'}</p>
            
            ${data.assessment ? `
                <h3>Assessment Results</h3>
                <p>Status: ${data.assessment.status}</p>
                <p>Completed: ${data.assessment.end_time ? new Date(data.assessment.end_time).toLocaleString() : 'N/A'}</p>
                
                <!-- Intelligence Report Section -->
                ${intelligenceHTML ? intelligenceHTML : ''}
                
                <!-- Spider Chart Section -->
                <h4>Dimensional Scores</h4>
                <div class="spider-chart-container">
                    <canvas id="spider-chart"></canvas>
                </div>
                
                <!-- Framework Mappings -->
                <h4>Framework Mappings</h4>
                <ul>
                    ${data.frameworkMappings ? data.frameworkMappings.map(mapping => `
                        <li>${mapping.framework}: ${mapping.result} (${(mapping.confidence * 100).toFixed(0)}% confidence)</li>
                    `).join('') : ''}
                </ul>
            ` : '<p>No assessment data available</p>'}
        `;
        
        // Create spider chart if assessment data exists
        if (data.dimensionalScores && data.dimensionalScores.length > 0) {
            setTimeout(() => {
                this.createSpiderChart(data.dimensionalScores);
            }, 100);
        }
        
        modal.style.display = 'block';
    }
    
    createSpiderChart(scores) {
        const ctx = document.getElementById('spider-chart').getContext('2d');
        
        new Chart(ctx, {
            type: 'radar',
            data: {
                labels: scores.map(s => s.dimension.replace(/_/g, ' ')),
                datasets: [{
                    label: 'Scores',
                    data: scores.map(s => s.score),
                    backgroundColor: 'rgba(0, 61, 130, 0.2)',
                    borderColor: 'rgba(0, 61, 130, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                scales: {
                    r: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }

    renderIntelligenceReport(report) {
        if (!report) return '';
        
        return `
            <div class="intelligence-report">
                <h3>Intelligence Report</h3>
                
                <!-- Executive Summary -->
                <div class="report-section">
                    <h4>Executive Summary</h4>
                    <p>${report.executive_summary}</p>
                </div>
                
                <!-- Key Strengths -->
                ${report.strengths && report.strengths.length > 0 ? `
                    <div class="report-section">
                        <h4>Key Strengths</h4>
                        <ul class="strengths-list">
                            ${report.strengths.slice(0, 3).map(strength => `
                                <li>
                                    <strong>${this.formatDimension(strength.dimension)} (${strength.score.toFixed(0)}%)</strong>
                                    <p>${strength.insight}</p>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <!-- Development Areas -->
                ${report.growth_areas && report.growth_areas.length > 0 ? `
                    <div class="report-section">
                        <h4>Development Areas</h4>
                        <ul class="growth-areas-list">
                            ${report.growth_areas.slice(0, 3).map(area => `
                                <li>
                                    <strong>${this.formatDimension(area.dimension)} (${area.score.toFixed(0)}%)</strong>
                                    <p>${area.insight}</p>
                                    <p class="recommendation"><em>Recommendation: ${area.recommendation}</em></p>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <!-- Behavioral Predictions -->
                ${report.behavioral_predictions && report.behavioral_predictions.length > 0 ? `
                    <div class="report-section">
                        <h4>Behavioral Predictions</h4>
                        <ul class="predictions-list">
                            ${report.behavioral_predictions.map(prediction => `
                                <li>
                                    <strong>${prediction.category}:</strong>
                                    ${prediction.prediction}
                                    <span class="confidence">(${prediction.confidence} confidence)</span>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <!-- Communication Style -->
                ${report.communication_style ? `
                    <div class="report-section">
                        <h4>Communication Style</h4>
                        <p><strong>Preferred Style:</strong> ${report.communication_style.preferred_style}</p>
                        <p><strong>Best Approach:</strong> ${report.communication_style.best_approach}</p>
                        ${report.communication_style.communication_tips && report.communication_style.communication_tips.length > 0 ? `
                            <p><strong>Tips for Effective Communication:</strong></p>
                            <ul>
                                ${report.communication_style.communication_tips.map(tip => `<li>${tip}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                ` : ''}
                
                <!-- Work Style -->
                ${report.work_style ? `
                    <div class="report-section">
                        <h4>Work Style</h4>
                        <p><strong>Pace:</strong> ${report.work_style.pace}</p>
                        <p><strong>Environment:</strong> ${report.work_style.environment}</p>
                        <p><strong>Motivation:</strong> ${report.work_style.motivation}</p>
                        ${report.work_style.strengths && report.work_style.strengths.length > 0 ? `
                            <p><strong>Work Strengths:</strong></p>
                            <ul>
                                ${report.work_style.strengths.map(strength => `<li>${strength}</li>`).join('')}
                            </ul>
                        ` : ''}
                    </div>
                ` : ''}
                
                <!-- Team Dynamics -->
                ${report.team_dynamics ? `
                    <div class="report-section">
                        <h4>Team Dynamics</h4>
                        <p><strong>Role Tendency:</strong> ${report.team_dynamics.role_tendency}</p>
                        <p><strong>Contribution Style:</strong> ${report.team_dynamics.contribution_style}</p>
                        <p><strong>Team Value:</strong> ${report.team_dynamics.team_value}</p>
                    </div>
                ` : ''}
                
                <!-- Risk Factors -->
                ${report.risk_factors && report.risk_factors.length > 0 ? `
                    <div class="report-section risk-section">
                        <h4>Risk Factors</h4>
                        <ul class="risk-list">
                            ${report.risk_factors.map(risk => `
                                <li class="risk-item risk-${risk.level.toLowerCase()}">
                                    <strong>${risk.level} - ${risk.factor}:</strong>
                                    <p>${risk.description}</p>
                                    <p class="mitigation"><em>Mitigation: ${risk.mitigation}</em></p>
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <!-- Cultural Fit -->
                ${report.cultural_fit_score ? `
                    <div class="report-section">
                        <h4>Northwestern Mutual Cultural Fit</h4>
                        <div class="cultural-fit-score">
                            <div class="score-display">
                                <span class="score-number">${report.cultural_fit_score}%</span>
                                <span class="score-label">Cultural Alignment</span>
                            </div>
                            <div class="score-bar">
                                <div class="score-fill" style="width: ${report.cultural_fit_score}%"></div>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                <!-- Role Fit Scores -->
                ${report.role_fit_scores ? `
                    <div class="report-section">
                        <h4>Role Fit Analysis</h4>
                        <div class="role-fit-container">
                            ${Object.entries(report.role_fit_scores).map(([role, score]) => `
                                <div class="role-fit-item">
                                    <span class="role-name">${this.formatRoleName(role)}</span>
                                    <div class="role-score-bar">
                                        <div class="role-score-fill" style="width: ${score}%"></div>
                                    </div>
                                    <span class="role-score">${score}%</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}
                
                <!-- Management Recommendations -->
                ${report.recommendations && report.recommendations.management_approach && report.recommendations.management_approach.length > 0 ? `
                    <div class="report-section">
                        <h4>Management Recommendations</h4>
                        <ul class="recommendations-list">
                            ${report.recommendations.management_approach.map(rec => `
                                <li>${rec}</li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <!-- Immediate Actions -->
                ${report.recommendations && report.recommendations.immediate_actions && report.recommendations.immediate_actions.length > 0 ? `
                    <div class="report-section">
                        <h4>Recommended Next Steps</h4>
                        <ul class="actions-list">
                            ${report.recommendations.immediate_actions.map(action => `
                                <li>${action}</li>
                            </li>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    formatDimension(dimension) {
        return dimension.replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    formatRoleName(role) {
        const roleNames = {
            financial_advisor: 'Financial Advisor',
            team_leader: 'Team Leader',
            analyst: 'Analyst',
            business_development: 'Business Development',
            client_service: 'Client Service'
        };
        return roleNames[role] || role;
    }
    
    async loadAnalytics() {
        try {
            const analytics = await this.apiClient.get('/dashboard/analytics');
            this.displayAnalytics(analytics);
        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }
    
    displayAnalytics(data) {
        // Dimensional averages chart
        this.createDimensionalChart(data.dimensionalAverages);
        
        // Top performers list
        const topPerformersList = document.getElementById('top-performers-list');
        topPerformersList.innerHTML = '';
        
        data.topPerformers.forEach(performer => {
            const item = document.createElement('div');
            item.className = 'performer-item';
            item.innerHTML = `
                <strong>${performer.first_name} ${performer.last_name}</strong>
                <span>Score: ${performer.avg_score.toFixed(1)}</span>
            `;
            topPerformersList.appendChild(item);
        });
        
        // Trends chart
        this.createTrendsChart(data.trends);
    }
    
    createDimensionalChart(dimensions) {
        const ctx = document.getElementById('dimensional-chart').getContext('2d');
        
        new Chart(ctx, {
            type: 'bar',
            data: {
                labels: dimensions.map(d => d.dimension.replace(/_/g, ' ')),
                datasets: [{
                    label: 'Average Score',
                    data: dimensions.map(d => d.avg_score),
                    backgroundColor: 'rgba(0, 61, 130, 0.6)',
                    borderColor: 'rgba(0, 61, 130, 1)',
                    borderWidth: 1
                }]
            },
            options: {
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100
                    }
                }
            }
        });
    }
    
    createTrendsChart(trends) {
        const ctx = document.getElementById('trends-chart').getContext('2d');
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: trends.map(t => new Date(t.week).toLocaleDateString()),
                datasets: [{
                    label: 'Candidates',
                    data: trends.map(t => t.candidates),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                }, {
                    label: 'Completions',
                    data: trends.map(t => t.completions),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }]
            }
        });
    }
    
    async compareCandidates() {
        if (this.selectedCandidates.size < 2) {
            alert('Please select at least 2 candidates to compare');
            return;
        }
        
        try {
            const comparison = await this.apiClient.post('/dashboard/compare', {
                candidateIds: Array.from(this.selectedCandidates)
            });
            
            this.displayComparison(comparison);
        } catch (error) {
            console.error('Failed to compare candidates:', error);
        }
    }
    
    displayComparison(data) {
        const resultsContainer = document.getElementById('comparison-results');
        
        resultsContainer.innerHTML = `
            <h3>Comparison Results</h3>
            
            <div class="comparison-grid">
                ${data.candidates.map(candidate => `
                    <div class="comparison-card">
                        <h4>${candidate.candidate.first_name} ${candidate.candidate.last_name}</h4>
                        <canvas id="compare-chart-${candidate.candidate.id}"></canvas>
                    </div>
                `).join('')}
            </div>
            
            <div class="insights">
                <h4>Insights</h4>
                <div class="strengths">
                    <h5>Shared Strengths</h5>
                    <ul>
                        ${data.insights.strengths.map(s => `
                            <li>${s.description}</li>
                        `).join('')}
                    </ul>
                </div>
                <div class="differences">
                    <h5>Key Differences</h5>
                    <ul>
                        ${data.insights.differences.map(d => `
                            <li>${d.description}</li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
        
        // Create individual charts
        data.candidates.forEach(candidate => {
            const ctx = document.getElementById(`compare-chart-${candidate.candidate.id}`).getContext('2d');
            new Chart(ctx, {
                type: 'radar',
                data: {
                    labels: candidate.scores.map(s => s.dimension.replace(/_/g, ' ')),
                    datasets: [{
                        label: 'Score',
                        data: candidate.scores.map(s => s.score),
                        backgroundColor: 'rgba(0, 61, 130, 0.2)',
                        borderColor: 'rgba(0, 61, 130, 1)',
                        borderWidth: 2
                    }]
                },
                options: {
                    scales: {
                        r: {
                            beginAtZero: true,
                            max: 100
                        }
                    }
                }
            });
        });
    }
    
    switchView(view) {
        // Update active nav button
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${view}"]`).classList.add('active');
        
        // Hide all views
        document.querySelectorAll('.view-section').forEach(section => {
            section.classList.remove('active');
        });
        
        // Show selected view
        document.getElementById(`${view}-view`).classList.add('active');
        
        this.currentView = view;
        
        // Emit view changed event
        window.dispatchEvent(new CustomEvent('viewChanged', { 
            detail: { view: view, previousView: this.previousView } 
        }));
        
        this.previousView = view;
        
        // Load view-specific data with force refresh
        if (view === 'candidates') {
            this.loadCandidates(true); // Force refresh
        } else if (view === 'analytics') {
            this.loadAnalytics(true); // Force refresh
        } else if (view === 'overview') {
            this.loadDashboardData(true); // Force refresh
        } else if (view === 'ai-dashboard') {
            this.loadAIDashboard(true); // Force refresh
        }
    }
    
    filterCandidates(searchTerm) {
        const filtered = this.candidates.filter(candidate => {
            const fullName = `${candidate.first_name} ${candidate.last_name}`.toLowerCase();
            const email = candidate.email.toLowerCase();
            const term = searchTerm.toLowerCase();
            
            return fullName.includes(term) || email.includes(term);
        });
        
        this.displayCandidates(filtered);
    }
    
    filterByStatus(status) {
        const filtered = status 
            ? this.candidates.filter(c => c.assessment_status === status)
            : this.candidates;
            
        this.displayCandidates(filtered);
    }
    
    async exportCSV() {
        try {
            const response = await this.apiClient.post('/export/csv', {
                filters: {}
            });
            
            alert(`Export started. Export ID: ${response.exportId}`);
            
            // Poll for completion
            setTimeout(() => this.checkExportStatus(response.exportId), 2000);
        } catch (error) {
            console.error('Failed to export CSV:', error);
        }
    }
    
    async checkExportStatus(exportId) {
        try {
            const response = await fetch(`http://localhost:3001/api/export/status/${exportId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                }
            });
            
            if (response.headers.get('content-type').includes('text/csv')) {
                // Download the file
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'candidates.csv';
                a.click();
            } else {
                // Still processing, check again
                setTimeout(() => this.checkExportStatus(exportId), 2000);
            }
        } catch (error) {
            console.error('Failed to check export status:', error);
        }
    }
    
    handleCandidateProgress(data) {
        // Update UI with real-time progress
        console.log('Candidate progress:', data);
        
        // Find and update the candidate in the list
        const candidateCard = document.querySelector(`[data-candidate-id="${data.candidateId}"]`);
        if (candidateCard) {
            const progressElement = candidateCard.querySelector('.candidate-progress');
            if (progressElement) {
                progressElement.textContent = `${data.completionPercentage}%`;
            }
        }
    }
    
    handleAssessmentCompleted(data) {
        // Show notification
        const notification = {
            title: 'Assessment Completed',
            message: `${data.candidateName} has completed their assessment`,
            created_at: new Date().toISOString()
        };
        
        const notificationsList = document.getElementById('notifications-list');
        const notifElement = this.createNotification(notification);
        notificationsList.insertBefore(notifElement, notificationsList.firstChild);
        
        // Refresh data
        this.loadDashboardData();
    }
    
    closeModal() {
        document.getElementById('candidate-modal').style.display = 'none';
    }
    
    logout() {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login.html';
    }
    
    loadAIDashboard(forceRefresh = false) {
        console.log('Loading AI Dashboard...', forceRefresh ? '(force refresh)' : '');
        
        // Make sure the container exists FIRST
        let container = document.getElementById('ai-dashboard');
        if (!container) {
            console.error('AI Dashboard container not found');
            return;
        }
        
        // Check if AI Dashboard component is available
        if (typeof aiDashboard === 'undefined' || !aiDashboard) {
            console.error('AI Dashboard component not loaded');
            return;
        }
        
        // Initialize the AI Dashboard
        const success = aiDashboard.initialize();
        if (!success) {
            console.error('Failed to initialize AI Dashboard');
        } else {
            console.log('AI Dashboard initialized successfully');
            
            // Force load recent candidates after initialization
            setTimeout(() => {
                if (aiDashboard.loadCandidatesList) {
                    console.log('Loading recent candidates...', forceRefresh ? '(force refresh)' : '');
                    aiDashboard.loadCandidatesList(forceRefresh);
                }
            }, 100);
        }
    }
    
    handleCandidateImported(candidateData) {
        console.log('Handling candidate import:', candidateData);
        
        // Refresh all views that might show candidates
        if (this.currentView === 'candidates') {
            this.loadCandidates(true);
        } else if (this.currentView === 'overview') {
            this.loadDashboardData(true);
        } else if (this.currentView === 'ai-dashboard') {
            // AI Dashboard will handle its own refresh
            console.log('AI Dashboard will handle its own refresh');
        }
        
        // Show success notification
        this.showNotification(`Candidate ${candidateData.candidate?.first_name || 'Unknown'} imported successfully!`, 'success');
    }
    
    showLoadingIndicator(containerId, message = 'Loading...') {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Create loading overlay
        const loadingOverlay = document.createElement('div');
        loadingOverlay.id = `${containerId}-loading`;
        loadingOverlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 1000;
            border-radius: 8px;
        `;
        
        loadingOverlay.innerHTML = `
            <div style="text-align: center;">
                <div style="
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                    margin: 0 auto 10px;
                "></div>
                <div style="color: #666; font-size: 14px;">${message}</div>
            </div>
        `;
        
        // Add CSS animation if not already added
        if (!document.getElementById('loading-spinner-styles')) {
            const style = document.createElement('style');
            style.id = 'loading-spinner-styles';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Make container relative positioned
        container.style.position = 'relative';
        container.appendChild(loadingOverlay);
    }
    
    hideLoadingIndicator(containerId) {
        const loadingOverlay = document.getElementById(`${containerId}-loading`);
        if (loadingOverlay) {
            loadingOverlay.remove();
        }
    }
    
    integrateWithStateManager() {
        console.log('Integrating dashboard with state manager...');
        
        // Subscribe to state manager events
        if (window.stateManager) {
            // Subscribe to candidate updates
            window.stateManager.subscribe('candidates', (candidates) => {
                console.log('StateManager: Candidates updated:', candidates.length);
                this.candidates = candidates;
                
                // Update current view if it's candidates view
                if (this.currentView === 'candidates') {
                    this.displayCandidates(candidates);
                    this.setupCandidateCheckboxes(candidates);
                }
            });
            
            // Subscribe to loading state
            window.stateManager.subscribe('loading', (isLoading) => {
                if (isLoading) {
                    this.showLoadingIndicator('candidates-table', 'Syncing data...');
                } else {
                    this.hideLoadingIndicator('candidates-table');
                }
            });
            
            // Subscribe to candidate added events
            window.stateManager.subscribe('candidateAdded', (candidate) => {
                console.log('StateManager: New candidate added:', candidate);
                this.showNotification(`New candidate ${candidate.first_name} ${candidate.last_name} added!`, 'success');
            });
        }
    }
}

// Initialize dashboard
const dashboard = new Dashboard();
