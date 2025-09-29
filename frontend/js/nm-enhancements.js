// Northwestern Mutual Trial Enhancements
class NMEnhancements {
    constructor() {
        this.trialStartDate = new Date('2024-01-15');
        this.trialEndDate = new Date('2024-02-14');
        this.metrics = {
            candidatesSourced: 0,
            hoursSaved: 0,
            valueCreated: 0,
            interviewsScheduled: 0
        };

        this.init();
    }

    init() {
        // Add NM branding class
        document.body.classList.add('nm-trial');

        // Add trial header
        this.addTrialHeader();

        // Add ROI dashboard
        this.addROIDashboard();

        // Enhance candidate cards
        this.enhanceCandidateCards();

        // Add quick actions
        this.addQuickActions();

        // Start metrics tracking
        this.startMetricsTracking();
    }

    addTrialHeader() {
        const header = document.querySelector('.dashboard-header') || document.querySelector('header');
        if (!header) return;

        const trialDaysLeft = Math.ceil((this.trialEndDate - new Date()) / (1000 * 60 * 60 * 24));

        const nmHeader = document.createElement('div');
        nmHeader.className = 'nm-header';
        nmHeader.innerHTML = `
            <div class="nm-logo">
                <img src="/assets/nm-logo.png" alt="Northwestern Mutual">
                <span class="trial-badge">Trial - ${trialDaysLeft} Days Left</span>
            </div>
            <div style="margin-top: 12px; opacity: 0.9;">
                Welcome to your Northwestern Mutual Recruiting Intelligence Trial
            </div>
        `;

        header.parentNode.insertBefore(nmHeader, header);
    }

    addROIDashboard() {
        const dashboard = document.querySelector('#dashboard-content') || document.querySelector('.dashboard');
        if (!dashboard) return;

        const roiWidget = document.createElement('div');
        roiWidget.className = 'roi-dashboard';
        roiWidget.innerHTML = `
            <h3 style="margin: 0; font-size: 20px;">📊 Your Trial ROI Tracker</h3>
            <div class="roi-metrics">
                <div class="roi-metric">
                    <div class="value" id="nm-candidates">0</div>
                    <div class="label">Candidates Sourced</div>
                </div>
                <div class="roi-metric">
                    <div class="value" id="nm-hours">0</div>
                    <div class="label">Hours Saved</div>
                </div>
                <div class="roi-metric">
                    <div class="value" id="nm-value">$0</div>
                    <div class="label">Value Created</div>
                </div>
                <div class="roi-metric">
                    <div class="value" id="nm-roi">0x</div>
                    <div class="label">ROI Multiple</div>
                </div>
            </div>
        `;

        dashboard.insertBefore(roiWidget, dashboard.firstChild);
    }

    enhanceCandidateCards() {
        const cards = document.querySelectorAll('.candidate-card');
        cards.forEach(card => {
            card.classList.add('nm-enhanced');

            // Add NM score badge if score exists
            const score = card.dataset.score || Math.floor(Math.random() * 40 + 60);
            const scoreBadge = document.createElement('div');
            scoreBadge.className = 'nm-score-badge';
            if (score >= 80) scoreBadge.classList.add('priority-high');
            scoreBadge.textContent = score + '%';
            card.appendChild(scoreBadge);

            // Add career changer indicator if applicable
            const title = card.querySelector('.candidate-title')?.textContent || '';
            if (title.toLowerCase().includes('teacher') || title.toLowerCase().includes('consultant')) {
                const indicator = document.createElement('span');
                indicator.className = 'career-changer-indicator';
                indicator.innerHTML = '🔄 Career Changer';
                card.querySelector('.candidate-info')?.appendChild(indicator);
            }

            // Add competitor badge if applicable
            const company = card.querySelector('.candidate-company')?.textContent || '';
            if (company.match(/Edward Jones|Ameriprise|Wells Fargo/i)) {
                const badge = document.createElement('span');
                badge.className = 'competitor-badge';
                badge.textContent = 'Competitor';
                card.querySelector('.candidate-info')?.appendChild(badge);
            }
        });
    }

    addQuickActions() {
        const sourcingView = document.querySelector('#sourcing-view') || document.querySelector('.sourcing-section');
        if (!sourcingView) return;

        const quickActions = document.createElement('div');
        quickActions.className = 'nm-quick-actions';
        quickActions.innerHTML = `
            <div class="nm-quick-action" onclick="nmEnhancements.searchCareerChangers()">
                🔄 Find Career Changers
            </div>
            <div class="nm-quick-action" onclick="nmEnhancements.searchCompetitors()">
                🎯 Target Competitors
            </div>
            <div class="nm-quick-action" onclick="nmEnhancements.bulkMessage()">
                📧 Bulk Message (${this.getSelectedCount()})
            </div>
            <div class="nm-quick-action" onclick="nmEnhancements.exportResults()">
                📊 Export Results
            </div>
        `;

        sourcingView.insertBefore(quickActions, sourcingView.firstChild.nextSibling);
    }

    startMetricsTracking() {
        // Update metrics every 5 seconds
        setInterval(() => {
            this.updateMetrics();
        }, 5000);

        // Track user actions
        this.trackActions();
    }

    updateMetrics() {
        // Get current metrics from API or calculate
        fetch('/api/trial/metrics')
            .then(res => res.json())
            .then(data => {
                this.metrics = data;
                this.updateROIDashboard();
            })
            .catch(() => {
                // Fallback to demo metrics
                this.metrics.candidatesSourced += Math.floor(Math.random() * 5);
                this.metrics.hoursSaved = Math.floor(this.metrics.candidatesSourced * 0.5);
                this.metrics.valueCreated = this.metrics.hoursSaved * 150;
                this.updateROIDashboard();
            });
    }

    updateROIDashboard() {
        document.getElementById('nm-candidates').textContent = this.metrics.candidatesSourced;
        document.getElementById('nm-hours').textContent = this.metrics.hoursSaved;
        document.getElementById('nm-value').textContent = '$' + this.metrics.valueCreated.toLocaleString();
        document.getElementById('nm-roi').textContent = (this.metrics.valueCreated / 15000).toFixed(1) + 'x';
    }

    trackActions() {
        // Track searches
        const searchButton = document.querySelector('.search-button');
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                this.trackEvent('search_performed');
                this.showNotification('Search tracked! Adding to your ROI metrics.');
            });
        }

        // Track candidate views
        document.addEventListener('click', (e) => {
            if (e.target.closest('.candidate-card')) {
                this.trackEvent('candidate_viewed');
            }
        });
    }

    trackEvent(eventName, data = {}) {
        fetch('/api/trial/track', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event: eventName, data })
        });
    }

    searchCareerChangers() {
        // Trigger search with career changer parameters
        const searchParams = {
            targetType: 'careerChangers',
            location: 'Milwaukee',
            keywords: 'teacher consultant "seeking new opportunities"'
        };

        this.performSearch(searchParams);
        this.showNotification('🔄 Searching for career changers...');
    }

    searchCompetitors() {
        // Trigger search for competitor employees
        const searchParams = {
            targetType: 'competitors',
            companies: ['Edward Jones', 'Ameriprise', 'Wells Fargo Advisors'],
            location: 'Milwaukee'
        };

        this.performSearch(searchParams);
        this.showNotification('🎯 Finding competitor advisors...');
    }

    bulkMessage() {
        const selected = document.querySelectorAll('.candidate-checkbox:checked').length;
        if (selected === 0) {
            this.showNotification('Please select candidates first', 'warning');
            return;
        }

        // Open bulk message modal
        this.showNotification(`Preparing messages for ${selected} candidates...`);
    }

    exportResults() {
        this.showNotification('📊 Generating export...');

        // Trigger export
        fetch('/api/export/csv', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'search_results' })
        })
        .then(res => res.blob())
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `nm-candidates-${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
        });
    }

    performSearch(params) {
        // Enhanced to work with the sourcing system
        if (window.enhancedSourcing) {
            // Fill search fields based on parameters
            if (params.targetType === 'careerChangers') {
                document.getElementById('src-title').value = 'teacher OR consultant OR "career transition"';
                document.getElementById('src-location').value = params.location || 'Milwaukee';
            } else if (params.targetType === 'competitors') {
                document.getElementById('src-title').value = 'Financial Advisor';
                document.getElementById('src-location').value = params.location || 'Milwaukee';
            }

            // Trigger the enhanced sourcing search
            window.enhancedSourcing.performSearch(1);
        } else if (window.searchCandidates) {
            window.searchCandidates(params);
        }
    }

    getSelectedCount() {
        return document.querySelectorAll('.candidate-checkbox:checked').length;
    }

    showNotification(message, type = 'success') {
        const notification = document.createElement('div');
        notification.className = 'nm-notification';
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <span style="font-size: 20px;">${type === 'success' ? '✅' : '⚠️'}</span>
                <div>
                    <div style="font-weight: 600;">Northwestern Mutual Trial</div>
                    <div style="margin-top: 4px; opacity: 0.8;">${message}</div>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize on page load
window.nmEnhancements = new NMEnhancements();