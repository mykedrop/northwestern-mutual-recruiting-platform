class KanbanBoard {
    constructor() {
        this.apiClient = new APIClient();
        this.socket = null;
        this.stages = [];
        this.candidates = {};
        this.selectedCandidates = new Set();
        this.sortableInstances = [];
        
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
        
        // Load pipeline data
        await this.loadPipeline();
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
        
        this.socket.on('pipeline-updated', (data) => {
            this.handlePipelineUpdate(data);
        });
        
        this.socket.on('pipeline-bulk-updated', (data) => {
            this.handleBulkUpdate(data);
        });
        
        this.socket.on('assessment-completed', (data) => {
            this.loadPipeline(); // Reload to get updated data
        });
    }
    
    setupEventListeners() {
        // Search
        document.getElementById('search-pipeline').addEventListener('input', (e) => {
            this.filterCandidates(e.target.value);
        });
        
        // Bulk actions
        document.getElementById('bulk-actions-btn').addEventListener('click', () => {
            this.showBulkActions();
        });
        
        document.getElementById('apply-bulk-action').addEventListener('click', () => {
            this.applyBulkAction();
        });
        
        // Refresh
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadPipeline();
        });
        
        // Back to dashboard
        document.getElementById('back-to-dashboard').addEventListener('click', () => {
            window.location.href = '/dashboard.html';
        });
        
        // Modal close buttons
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.target.closest('.modal').style.display = 'none';
            });
        });
    }
    
    async loadPipeline() {
        try {
            const pipeline = await this.apiClient.get('/pipeline/view');
            this.stages = pipeline;
            this.renderBoard();
            this.updateStats();
        } catch (error) {
            console.error('Failed to load pipeline:', error);
        }
    }
    
    renderBoard() {
        const board = document.getElementById('kanban-board');
        board.innerHTML = '';
        
        // Destroy existing sortable instances
        this.sortableInstances.forEach(instance => instance.destroy());
        this.sortableInstances = [];
        
        // Create columns for each stage
        this.stages.forEach(stage => {
            const column = this.createColumn(stage);
            board.appendChild(column);
        });
        
        // Make columns sortable
        this.initSortable();
    }
    
    createColumn(stage) {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.dataset.stageId = stage.id;
        
        // Column header
        const header = document.createElement('div');
        header.className = 'column-header';
        header.style.borderColor = stage.color;
        header.innerHTML = `
            <span class="column-title">${stage.name}</span>
            <span class="column-count">${stage.candidates.length}</span>
        `;
        
        // Column cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'column-cards drop-zone';
        cardsContainer.dataset.stageId = stage.id;
        
        // Add candidates
        stage.candidates.forEach(candidate => {
            const card = this.createCandidateCard(candidate);
            cardsContainer.appendChild(card);
            this.candidates[candidate.id] = candidate;
        });
        
        column.appendChild(header);
        column.appendChild(cardsContainer);
        
        return column;
    }
    
    createCandidateCard(candidate) {
        const card = document.createElement('div');
        card.className = 'candidate-card';
        card.dataset.candidateId = candidate.id;
        card.draggable = true;
        
        // Assessment status
        const hasAssessment = candidate.assessment_status === 'completed';
        const culturalFit = candidate.cultural_fit_score || 0;
        
        card.innerHTML = `
            <input type="checkbox" class="card-checkbox" 
                   onchange="kanban.toggleSelection('${candidate.id}')">
            <div class="candidate-name">${candidate.first_name} ${candidate.last_name}</div>
            <div class="candidate-email">${candidate.email}</div>
            <div class="candidate-meta">
                ${hasAssessment ? '<span class="meta-tag assessment-complete">✓ Assessed</span>' : ''}
                ${culturalFit >= 80 ? '<span class="meta-tag high-fit">High Fit</span>' : ''}
                ${candidate.top_strength ? `<span class="meta-tag">${this.formatDimension(candidate.top_strength)}</span>` : ''}
            </div>
            ${culturalFit > 0 ? `
                <div class="candidate-score">
                    <span class="score-label">Cultural Fit:</span>
                    <span class="score-value">${culturalFit}%</span>
                </div>
            ` : ''}
        `;
        
        // Click handler for details
        card.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                this.showCandidateDetail(candidate.id);
            }
        });
        
        return card;
    }
    
    formatDimension(dimension) {
        return dimension.replace(/_/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    initSortable() {
        const dropZones = document.querySelectorAll('.drop-zone');
        
        dropZones.forEach(zone => {
            const sortable = Sortable.create(zone, {
                group: 'candidates',
                animation: 150,
                ghostClass: 'dragging',
                onEnd: async (evt) => {
                    const candidateId = evt.item.dataset.candidateId;
                    const newStageId = evt.to.dataset.stageId;
                    const oldStageId = evt.from.dataset.stageId;
                    
                    if (newStageId !== oldStageId) {
                        await this.moveCandidate(candidateId, newStageId);
                    }
                }
            });
            
            this.sortableInstances.push(sortable);
        });
    }
    
    async moveCandidate(candidateId, stageId) {
        try {
            await this.apiClient.post('/pipeline/move', {
                candidateId,
                stageId,
                notes: 'Moved via Kanban board'
            });
            
            // Update local data
            this.candidates[candidateId].stage_id = stageId;
            this.updateStats();
        } catch (error) {
            console.error('Failed to move candidate:', error);
            // Reload to reset position
            this.loadPipeline();
        }
    }
    
    toggleSelection(candidateId) {
        if (this.selectedCandidates.has(candidateId)) {
            this.selectedCandidates.delete(candidateId);
            document.querySelector(`[data-candidate-id="${candidateId}"]`)
                .classList.remove('selected');
        } else {
            this.selectedCandidates.add(candidateId);
            document.querySelector(`[data-candidate-id="${candidateId}"]`)
                .classList.add('selected');
        }
    }
    
    showBulkActions() {
        if (this.selectedCandidates.size === 0) {
            alert('Please select at least one candidate');
            return;
        }
        
        const modal = document.getElementById('bulk-actions-modal');
        const select = document.getElementById('bulk-stage-select');
        const count = document.getElementById('selected-count');
        
        // Update count
        count.textContent = this.selectedCandidates.size;
        
        // Populate stages
        select.innerHTML = '';
        this.stages.forEach(stage => {
            const option = document.createElement('option');
            option.value = stage.id;
            option.textContent = stage.name;
            select.appendChild(option);
        });
        
        modal.style.display = 'block';
    }
    
    async applyBulkAction() {
        const stageId = document.getElementById('bulk-stage-select').value;
        
        try {
            await this.apiClient.post('/pipeline/bulk-move', {
                candidateIds: Array.from(this.selectedCandidates),
                stageId
            });
            
            // Clear selection
            this.selectedCandidates.clear();
            
            // Close modal
            document.getElementById('bulk-actions-modal').style.display = 'none';
            
            // Reload pipeline
            await this.loadPipeline();
        } catch (error) {
            console.error('Failed to apply bulk action:', error);
        }
    }
    
    async showCandidateDetail(candidateId) {
        try {
            const detail = await this.apiClient.get(`/dashboard/candidate/${candidateId}`);
            const modal = document.getElementById('candidate-detail-modal');
            const content = document.getElementById('candidate-detail-content');
            
            // Get intelligence report if available
            let intelligenceHTML = '';
            if (detail.assessment && detail.assessment.status === 'completed') {
                const report = await this.apiClient.get(`/assessment/intelligence/${detail.assessment.id}`);
                intelligenceHTML = this.renderIntelligenceReport(report);
            }
            
            content.innerHTML = `
                <h2>${detail.candidate.first_name} ${detail.candidate.last_name}</h2>
                <div class="candidate-info">
                    <p><strong>Email:</strong> ${detail.candidate.email}</p>
                    <p><strong>Phone:</strong> ${detail.candidate.phone || 'N/A'}</p>
                    <p><strong>Added:</strong> ${new Date(detail.candidate.created_at).toLocaleDateString()}</p>
                </div>
                
                ${intelligenceHTML}
                
                <div class="action-buttons">
                    <button onclick="window.location.href='mailto:${detail.candidate.email}'">
                        Email Candidate
                    </button>
                    <button onclick="kanban.scheduleInterview('${candidateId}')">
                        Schedule Interview
                    </button>
                    <button onclick="kanban.exportReport('${candidateId}')">
                        Export Report
                    </button>
                </div>
            `;
            
            modal.style.display = 'block';
        } catch (error) {
            console.error('Failed to load candidate detail:', error);
        }
    }
    
    renderIntelligenceReport(report) {
        if (!report) return '<p>No intelligence report available</p>';
        
        return `
            <div class="intelligence-report">
                <h3>Intelligence Report</h3>
                
                <section class="report-section">
                    <h4>Executive Summary</h4>
                    <p>${report.executive_summary}</p>
                </section>
                
                <section class="report-section">
                    <h4>Key Strengths</h4>
                    <ul>
                        ${report.strengths.map(s => `
                            <li>
                                <strong>${this.formatDimension(s.dimension)}:</strong>
                                ${s.insight}
                            </li>
                        `).join('')}
                    </ul>
                </section>
                
                <section class="report-section">
                    <h4>Development Areas</h4>
                    <ul>
                        ${report.growth_areas.map(g => `
                            <li>
                                <strong>${this.formatDimension(g.dimension)}:</strong>
                                ${g.insight}
                                <br><em>Recommendation: ${g.recommendation}</em>
                            </li>
                        `).join('')}
                    </ul>
                </section>
                
                <section class="report-section">
                    <h4>Behavioral Predictions</h4>
                    <ul>
                        ${report.behavioral_predictions.map(p => `
                            <li>
                                <strong>${p.category}:</strong>
                                ${p.prediction}
                                <span class="confidence">(${p.confidence} confidence)</span>
                            </li>
                        `).join('')}
                    </ul>
                </section>
                
                <section class="report-section">
                    <h4>Communication Style</h4>
                    <p><strong>Preferred Style:</strong> ${report.communication_style.preferred_style}</p>
                    <p><strong>Best Approach:</strong> ${report.communication_style.best_approach}</p>
                    <ul>
                        ${report.communication_style.communication_tips.map(tip => `
                            <li>${tip}</li>
                        `).join('')}
                    </ul>
                </section>
                
                <section class="report-section">
                    <h4>Risk Factors</h4>
                    ${report.risk_factors.length > 0 ? `
                        <ul>
                            ${report.risk_factors.map(r => `
                                <li class="risk-${r.level.toLowerCase()}">
                                    <strong>${r.factor}:</strong> ${r.description}
                                    <br><em>Mitigation: ${r.mitigation}</em>
                                </li>
                            `).join('')}
                        </ul>
                    ` : '<p>No significant risk factors identified</p>'}
                </section>
                
                <section class="report-section">
                    <h4>Role Fit Scores</h4>
                    <div class="role-fit-scores">
                        ${Object.entries(report.role_fit_scores).map(([role, score]) => `
                            <div class="role-fit">
                                <span>${this.formatDimension(role)}:</span>
                                <div class="score-bar">
                                    <div class="score-fill" style="width: ${score}%"></div>
                                </div>
                                <span>${score}%</span>
                            </div>
                        `).join('')}
                    </div>
                </section>
                
                <section class="report-section">
                    <h4>Management Recommendations</h4>
                    <ul>
                        ${report.recommendations.management_approach.map(rec => `
                            <li>${rec}</li>
                        `).join('')}
                    </ul>
                </section>
            </div>
        `;
    }
    
    filterCandidates(searchTerm) {
        const cards = document.querySelectorAll('.candidate-card');
        const term = searchTerm.toLowerCase();
        
        cards.forEach(card => {
            const name = card.querySelector('.candidate-name').textContent.toLowerCase();
            const email = card.querySelector('.candidate-email').textContent.toLowerCase();
            
            if (name.includes(term) || email.includes(term)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    }
    
    updateStats() {
        let total = 0;
        let inProgress = 0;
        let completed = 0;
        
        this.stages.forEach(stage => {
            total += stage.candidates.length;
            
            if (['Assessment Sent', 'Interview Scheduled', 'Interview Complete', 'Reference Check'].includes(stage.name)) {
                inProgress += stage.candidates.length;
            } else if (['Hired'].includes(stage.name)) {
                completed += stage.candidates.length;
            }
        });
        
        document.getElementById('total-candidates').textContent = `${total} Total`;
        document.getElementById('in-progress').textContent = `${inProgress} In Progress`;
        document.getElementById('completed').textContent = `${completed} Completed`;
    }
    
    handlePipelineUpdate(data) {
        // Reload pipeline when updates occur
        this.loadPipeline();
    }
    
    handleBulkUpdate(data) {
        // Reload pipeline when bulk updates occur
        this.loadPipeline();
    }
    
    async scheduleInterview(candidateId) {
        // Placeholder for interview scheduling
        alert('Interview scheduling feature coming soon!');
    }
    
    async exportReport(candidateId) {
        try {
            await this.apiClient.post('/export/pdf', {
                candidateIds: [candidateId]
            });
            alert('Report export started. You will receive it shortly.');
        } catch (error) {
            console.error('Failed to export report:', error);
        }
    }
}

// Initialize Kanban board
const kanban = new KanbanBoard();
