/**
 * Central State Manager for Dashboard
 * Handles real-time data synchronization and state management
 */
class StateManager {
    constructor() {
        this.state = {
            candidates: [],
            isLoading: false,
            lastUpdated: null,
            subscribers: new Map()
        };
        
        this.init();
    }
    
    init() {
        // Set up periodic data refresh
        this.startPeriodicRefresh();
        
        // Listen for custom events
        this.setupEventListeners();
        
        console.log('StateManager initialized');
    }
    
    setupEventListeners() {
        // Listen for candidate import events
        window.addEventListener('candidateImported', (event) => {
            console.log('StateManager: Candidate imported event received');
            this.handleCandidateImported(event.detail);
        });
        
        // Listen for view changes
        window.addEventListener('viewChanged', (event) => {
            console.log('StateManager: View changed to', event.detail.view);
            this.refreshCurrentView();
        });
    }
    
    startPeriodicRefresh() {
        // Refresh data every 30 seconds
        setInterval(() => {
            if (!this.state.isLoading) {
                this.refreshData();
            }
        }, 30000);
    }
    
    async refreshData() {
        if (this.state.isLoading) return;
        
        this.state.isLoading = true;
        this.notifySubscribers('loading', true);
        
        try {
            console.log('StateManager: Refreshing data...');
            
            // Fetch fresh data
            const response = await fetch((window.API_BASE_URL || '') + '/api/candidates', {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}` 
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const candidates = await response.json();
            
            // Update state
            this.state.candidates = candidates;
            this.state.lastUpdated = new Date();
            this.state.isLoading = false;
            
            console.log(`StateManager: Refreshed ${candidates.length} candidates`);
            
            // Notify subscribers
            this.notifySubscribers('candidates', candidates);
            this.notifySubscribers('loading', false);
            
        } catch (error) {
            console.error('StateManager: Error refreshing data:', error);
            this.state.isLoading = false;
            this.notifySubscribers('loading', false);
            this.notifySubscribers('error', error.message);
        }
    }
    
    handleCandidateImported(candidateData) {
        console.log('StateManager: Handling candidate import:', candidateData);
        
        // Add the new candidate to state immediately (optimistic update)
        if (candidateData.candidate) {
            this.state.candidates.unshift(candidateData.candidate);
            this.state.lastUpdated = new Date();
            
            // Notify subscribers
            this.notifySubscribers('candidates', this.state.candidates);
            this.notifySubscribers('candidateAdded', candidateData.candidate);
        }
        
        // Refresh data to ensure consistency
        setTimeout(() => {
            this.refreshData();
        }, 1000);
    }
    
    refreshCurrentView() {
        const activeView = document.querySelector('.view-section.active');
        if (!activeView) return;
        
        const viewId = activeView.id;
        console.log('StateManager: Refreshing current view:', viewId);
        
        switch(viewId) {
            case 'candidates-view':
                this.refreshCandidatesView();
                break;
            case 'overview-view':
                this.refreshOverviewView();
                break;
            case 'ai-dashboard-view':
                this.refreshAIDashboardView();
                break;
        }
    }
    
    refreshCandidatesView() {
        if (window.dashboard && window.dashboard.loadCandidates) {
            window.dashboard.loadCandidates(true);
        }
    }
    
    refreshOverviewView() {
        if (window.dashboard && window.dashboard.loadDashboardData) {
            window.dashboard.loadDashboardData(true);
        }
    }
    
    refreshAIDashboardView() {
        if (window.aiDashboard && window.aiDashboard.loadCandidatesList) {
            window.aiDashboard.loadCandidatesList(true);
        }
    }
    
    // Subscription system
    subscribe(key, callback) {
        if (!this.state.subscribers.has(key)) {
            this.state.subscribers.set(key, new Set());
        }
        this.state.subscribers.get(key).add(callback);
        
        // Return unsubscribe function
        return () => {
            const subscribers = this.state.subscribers.get(key);
            if (subscribers) {
                subscribers.delete(callback);
            }
        };
    }
    
    notifySubscribers(key, data) {
        const subscribers = this.state.subscribers.get(key);
        if (subscribers) {
            subscribers.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error('StateManager: Error in subscriber callback:', error);
                }
            });
        }
    }
    
    // Getters
    getCandidates() {
        return this.state.candidates;
    }
    
    isLoading() {
        return this.state.isLoading;
    }
    
    getLastUpdated() {
        return this.state.lastUpdated;
    }
    
    // Force refresh
    async forceRefresh() {
        console.log('StateManager: Force refresh requested');
        await this.refreshData();
    }
}

// Create global instance
window.stateManager = new StateManager();

// Make it globally available
window.StateManager = StateManager;











