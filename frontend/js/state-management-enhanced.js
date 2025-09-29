// Enhanced State Management System for Northwestern Mutual Platform
// Using Zustand-like pattern for professional state management

class StateStore {
    constructor() {
        this.state = {};
        this.listeners = new Set();
        this.middleware = [];
        this.devTools = window.__REDUX_DEVTOOLS_EXTENSION__;

        // Initialize with default state
        this.setState({
            // Authentication State
            user: null,
            isAuthenticated: false,
            authLoading: false,

            // Candidates State
            candidates: [],
            selectedCandidate: null,
            candidateFilters: {
                search: '',
                status: 'all',
                score: null,
                location: '',
                experience: null
            },
            candidatesLoading: false,
            candidatesError: null,
            candidatesPagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0
            },

            // Sourcing State
            sourcingResults: [],
            sourcingLoading: false,
            sourcingError: null,
            sourcingFilters: {
                title: '',
                location: '',
                keywords: '',
                targetType: 'general'
            },
            sourcingPagination: {
                page: 1,
                limit: 20,
                total: 0,
                totalPages: 0
            },

            // Assessment State
            assessments: [],
            currentAssessment: null,
            assessmentLoading: false,
            assessmentError: null,

            // Dashboard State
            dashboardStats: {
                totalCandidates: 0,
                completedAssessments: 0,
                averageScore: 0,
                activeRecruiters: 0
            },
            dashboardLoading: false,

            // UI State
            currentView: 'overview',
            sidebarOpen: true,
            notifications: [],
            modals: [],
            loading: {},
            errors: {},

            // Northwestern Mutual Trial State
            trial: {
                isActive: false,
                daysLeft: 0,
                metrics: {
                    candidatesSourced: 0,
                    hoursSaved: 0,
                    valueCreated: 0,
                    roiMultiple: 0
                }
            }
        });

        this.setupDevTools();
        console.log('✅ Enhanced State Management initialized');
    }

    setupDevTools() {
        if (this.devTools) {
            this.devToolsConnection = this.devTools.connect({
                name: 'Northwestern Mutual Platform'
            });
            this.devToolsConnection.init(this.state);
        }
    }

    // Core state management methods
    setState(update, action = 'SET_STATE') {
        const prevState = { ...this.state };

        if (typeof update === 'function') {
            this.state = { ...this.state, ...update(this.state) };
        } else {
            this.state = { ...this.state, ...update };
        }

        // Apply middleware
        this.middleware.forEach(middleware => {
            middleware(prevState, this.state, action);
        });

        // Notify listeners
        this.listeners.forEach(listener => listener(this.state, prevState));

        // DevTools
        if (this.devToolsConnection) {
            this.devToolsConnection.send(action, this.state);
        }
    }

    getState() {
        return this.state;
    }

    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    addMiddleware(middleware) {
        this.middleware.push(middleware);
    }

    // Action creators for different domains

    // Authentication Actions
    setAuthLoading(loading) {
        this.setState({ authLoading: loading }, 'SET_AUTH_LOADING');
    }

    setUser(user) {
        this.setState({
            user,
            isAuthenticated: !!user,
            authLoading: false
        }, 'SET_USER');
    }

    logout() {
        this.setState({
            user: null,
            isAuthenticated: false,
            authLoading: false
        }, 'LOGOUT');
    }

    // Candidates Actions
    setCandidatesLoading(loading) {
        this.setState({ candidatesLoading: loading }, 'SET_CANDIDATES_LOADING');
    }

    setCandidates(candidates, pagination = null) {
        const update = {
            candidates,
            candidatesLoading: false,
            candidatesError: null
        };

        if (pagination) {
            update.candidatesPagination = { ...this.state.candidatesPagination, ...pagination };
        }

        this.setState(update, 'SET_CANDIDATES');
    }

    addCandidate(candidate) {
        this.setState(state => ({
            candidates: [...state.candidates, candidate],
            dashboardStats: {
                ...state.dashboardStats,
                totalCandidates: state.dashboardStats.totalCandidates + 1
            }
        }), 'ADD_CANDIDATE');
    }

    updateCandidate(candidateId, updates) {
        this.setState(state => ({
            candidates: state.candidates.map(candidate =>
                candidate.id === candidateId ? { ...candidate, ...updates } : candidate
            ),
            selectedCandidate: state.selectedCandidate?.id === candidateId
                ? { ...state.selectedCandidate, ...updates }
                : state.selectedCandidate
        }), 'UPDATE_CANDIDATE');
    }

    setSelectedCandidate(candidate) {
        this.setState({ selectedCandidate: candidate }, 'SET_SELECTED_CANDIDATE');
    }

    setCandidateFilters(filters) {
        this.setState(state => ({
            candidateFilters: { ...state.candidateFilters, ...filters }
        }), 'SET_CANDIDATE_FILTERS');
    }

    setCandidatesError(error) {
        this.setState({
            candidatesError: error,
            candidatesLoading: false
        }, 'SET_CANDIDATES_ERROR');
    }

    // Sourcing Actions
    setSourcingLoading(loading) {
        this.setState({ sourcingLoading: loading }, 'SET_SOURCING_LOADING');
    }

    setSourcingResults(results, pagination = null) {
        const update = {
            sourcingResults: results,
            sourcingLoading: false,
            sourcingError: null
        };

        if (pagination) {
            update.sourcingPagination = { ...this.state.sourcingPagination, ...pagination };
        }

        this.setState(update, 'SET_SOURCING_RESULTS');
    }

    setSourcingFilters(filters) {
        this.setState(state => ({
            sourcingFilters: { ...state.sourcingFilters, ...filters }
        }), 'SET_SOURCING_FILTERS');
    }

    setSourcingError(error) {
        this.setState({
            sourcingError: error,
            sourcingLoading: false
        }, 'SET_SOURCING_ERROR');
    }

    // Assessment Actions
    setAssessmentLoading(loading) {
        this.setState({ assessmentLoading: loading }, 'SET_ASSESSMENT_LOADING');
    }

    setAssessments(assessments) {
        this.setState({
            assessments,
            assessmentLoading: false,
            assessmentError: null
        }, 'SET_ASSESSMENTS');
    }

    setCurrentAssessment(assessment) {
        this.setState({ currentAssessment: assessment }, 'SET_CURRENT_ASSESSMENT');
    }

    addAssessment(assessment) {
        this.setState(state => ({
            assessments: [...state.assessments, assessment],
            dashboardStats: {
                ...state.dashboardStats,
                completedAssessments: state.dashboardStats.completedAssessments + 1
            }
        }), 'ADD_ASSESSMENT');
    }

    // Dashboard Actions
    setDashboardLoading(loading) {
        this.setState({ dashboardLoading: loading }, 'SET_DASHBOARD_LOADING');
    }

    setDashboardStats(stats) {
        this.setState({
            dashboardStats: { ...this.state.dashboardStats, ...stats },
            dashboardLoading: false
        }, 'SET_DASHBOARD_STATS');
    }

    // UI Actions
    setCurrentView(view) {
        this.setState({ currentView: view }, 'SET_CURRENT_VIEW');
    }

    setSidebarOpen(open) {
        this.setState({ sidebarOpen: open }, 'SET_SIDEBAR_OPEN');
    }

    addNotification(notification) {
        const id = Date.now().toString();
        const notificationWithId = { ...notification, id };

        this.setState(state => ({
            notifications: [...state.notifications, notificationWithId]
        }), 'ADD_NOTIFICATION');

        return id;
    }

    removeNotification(id) {
        this.setState(state => ({
            notifications: state.notifications.filter(n => n.id !== id)
        }), 'REMOVE_NOTIFICATION');
    }

    setLoading(key, loading) {
        this.setState(state => ({
            loading: { ...state.loading, [key]: loading }
        }), 'SET_LOADING');
    }

    setError(key, error) {
        this.setState(state => ({
            errors: { ...state.errors, [key]: error }
        }), 'SET_ERROR');
    }

    clearError(key) {
        this.setState(state => {
            const { [key]: removed, ...rest } = state.errors;
            return { errors: rest };
        }, 'CLEAR_ERROR');
    }

    // Northwestern Mutual Trial Actions
    setTrialActive(isActive, daysLeft = 0) {
        this.setState(state => ({
            trial: { ...state.trial, isActive, daysLeft }
        }), 'SET_TRIAL_ACTIVE');
    }

    updateTrialMetrics(metrics) {
        this.setState(state => ({
            trial: {
                ...state.trial,
                metrics: { ...state.trial.metrics, ...metrics }
            }
        }), 'UPDATE_TRIAL_METRICS');
    }

    // Computed selectors
    getFilteredCandidates() {
        const { candidates, candidateFilters } = this.state;

        return candidates.filter(candidate => {
            if (candidateFilters.search &&
                !candidate.name?.toLowerCase().includes(candidateFilters.search.toLowerCase()) &&
                !candidate.email?.toLowerCase().includes(candidateFilters.search.toLowerCase())) {
                return false;
            }

            if (candidateFilters.status !== 'all' && candidate.status !== candidateFilters.status) {
                return false;
            }

            if (candidateFilters.score && candidate.score < candidateFilters.score) {
                return false;
            }

            if (candidateFilters.location &&
                !candidate.location?.toLowerCase().includes(candidateFilters.location.toLowerCase())) {
                return false;
            }

            return true;
        });
    }

    getHighPriorityCandidates() {
        return this.state.candidates.filter(candidate =>
            candidate.priority === 'HIGH' || candidate.score >= 0.8
        );
    }

    getTotalNotifications() {
        return this.state.notifications.length;
    }

    getLoadingState(key) {
        return this.state.loading[key] || false;
    }

    getError(key) {
        return this.state.errors[key] || null;
    }

    // Async action creators
    async fetchCandidates(filters = {}) {
        this.setCandidatesLoading(true);

        try {
            const response = await fetch('/api/candidates?' + new URLSearchParams(filters));
            const data = await response.json();

            if (response.ok) {
                this.setCandidates(data.candidates, data.pagination);
            } else {
                this.setCandidatesError(data.error || 'Failed to fetch candidates');
            }
        } catch (error) {
            this.setCandidatesError('Network error occurred');
        }
    }

    async fetchDashboardStats() {
        this.setDashboardLoading(true);

        try {
            const response = await fetch('/api/dashboard/stats');
            const stats = await response.json();

            if (response.ok) {
                this.setDashboardStats(stats);
            } else {
                this.setError('dashboard', stats.error || 'Failed to fetch dashboard stats');
            }
        } catch (error) {
            this.setError('dashboard', 'Network error occurred');
        } finally {
            this.setDashboardLoading(false);
        }
    }

    async performSourcing(filters) {
        this.setSourcingLoading(true);

        try {
            const response = await fetch('/api/sourcing/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filters)
            });

            const data = await response.json();

            if (response.ok) {
                this.setSourcingResults(data.candidates, data.pagination);

                // Update trial metrics if trial is active
                if (this.state.trial.isActive) {
                    this.updateTrialMetrics({
                        candidatesSourced: this.state.trial.metrics.candidatesSourced + data.candidates.length
                    });
                }
            } else {
                this.setSourcingError(data.error || 'Sourcing failed');
            }
        } catch (error) {
            this.setSourcingError('Network error occurred');
        }
    }
}

// Middleware for logging
const loggingMiddleware = (prevState, nextState, action) => {
    if (process.env.NODE_ENV === 'development') {
        console.group(`🔄 State Update: ${action}`);
        console.log('Previous:', prevState);
        console.log('Next:', nextState);
        console.groupEnd();
    }
};

// Middleware for persistence
const persistenceMiddleware = (prevState, nextState, action) => {
    // Persist certain state to localStorage
    const stateToPersist = {
        user: nextState.user,
        candidateFilters: nextState.candidateFilters,
        sourcingFilters: nextState.sourcingFilters,
        currentView: nextState.currentView,
        sidebarOpen: nextState.sidebarOpen
    };

    try {
        localStorage.setItem('nm-platform-state', JSON.stringify(stateToPersist));
    } catch (error) {
        console.warn('Failed to persist state:', error);
    }
};

// Initialize global store
const store = new StateStore();

// Add middleware
store.addMiddleware(loggingMiddleware);
store.addMiddleware(persistenceMiddleware);

// Load persisted state
try {
    const persistedState = localStorage.getItem('nm-platform-state');
    if (persistedState) {
        const parsed = JSON.parse(persistedState);
        store.setState(parsed, 'LOAD_PERSISTED_STATE');
    }
} catch (error) {
    console.warn('Failed to load persisted state:', error);
}

// React-like hooks for state management
function useStore(selector) {
    const state = store.getState();
    return selector ? selector(state) : state;
}

function useStoreAction(actionName) {
    return (...args) => store[actionName](...args);
}

// Export store and utilities
window.store = store;
window.useStore = useStore;
window.useStoreAction = useStoreAction;

// Helper to connect components to store
function connectToStore(component, mapStateToProps, mapActionsToProps) {
    return function ConnectedComponent(props) {
        const state = useStore(mapStateToProps);
        const actions = {};

        if (mapActionsToProps) {
            Object.keys(mapActionsToProps).forEach(key => {
                actions[key] = useStoreAction(mapActionsToProps[key]);
            });
        }

        return component({ ...props, ...state, ...actions });
    };
}

window.connectToStore = connectToStore;

console.log('✅ Enhanced State Management System ready');

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StateStore, store, useStore, useStoreAction, connectToStore };
}