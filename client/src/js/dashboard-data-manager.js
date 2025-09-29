/**
 * Central Data Manager for Dashboard
 * Handles data refresh across all views
 */
class DashboardDataManager {
    static async refreshAllViews() {
        console.log('Refreshing all dashboard views...');
        
        // Refresh each view that's currently active
        const activeView = document.querySelector('.view-section:not([style*="none"])');
        const viewId = activeView ? activeView.id : '';
        
        console.log('Active view:', viewId);
        
        switch(viewId) {
            case 'overview-view':
                await this.refreshOverview();
                break;
            case 'candidates-view':
                await this.refreshCandidates();
                break;
            case 'pipeline-view':
                await this.refreshPipeline();
                break;
            case 'analytics-view':
                await this.refreshAnalytics();
                break;
            case 'compare-view':
                await this.refreshCompare();
                break;
            case 'ai-dashboard-view':
                await this.refreshAIDashboard();
                break;
        }
    }
    
    static async refreshCandidates() {
        try {
            console.log('Refreshing candidates view...');
            const response = await fetch('http://localhost:3001/api/dashboard/candidates', {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}` 
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Candidates data refreshed:', data.length, 'candidates');
            
            // Update the candidates table with fresh data
            const tableBody = document.querySelector('#candidates-table tbody');
            if (tableBody && data.length > 0) {
                tableBody.innerHTML = data.map(c => `
                    <tr>
                        <td>${c.first_name} ${c.last_name}</td>
                        <td>${c.email}</td>
                        <td>${c.status || 'New'}</td>
                        <td>${c.pipeline_stage || 'Not in pipeline'}</td>
                        <td><button onclick="viewCandidate('${c.id}')">View</button></td>
                    </tr>
                `).join('');
            }
            
            return data;
        } catch (error) {
            console.error('Error refreshing candidates:', error);
            this.showError('Failed to refresh candidates data. Please refresh the page.');
            return null;
        }
    }
    
    static async refreshPipeline() {
        try {
            console.log('Refreshing pipeline view...');
            const response = await fetch('http://localhost:3001/api/pipeline/view', {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}` 
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Pipeline data refreshed:', data.length, 'stages');
            
            // Update pipeline view
            if (window.dashboard && window.dashboard.renderPipeline) {
                window.dashboard.renderPipeline(data);
            }
            
            return data;
        } catch (error) {
            console.error('Error refreshing pipeline:', error);
            this.showError('Failed to refresh pipeline data. Please refresh the page.');
            return null;
        }
    }
    
    static async refreshOverview() {
        try {
            console.log('Refreshing overview...');
            const response = await fetch('http://localhost:3001/api/dashboard/overview', {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}` 
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Overview data refreshed');
            
            // Update overview view
            if (window.dashboard && window.dashboard.renderOverview) {
                window.dashboard.renderOverview(data);
            }
            
            return data;
        } catch (error) {
            console.error('Error refreshing overview:', error);
            this.showError('Failed to refresh overview data. Please refresh the page.');
            return null;
        }
    }
    
    static async refreshAnalytics() {
        try {
            console.log('Refreshing analytics...');
            const response = await fetch('http://localhost:3001/api/dashboard/analytics', {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}` 
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Analytics data refreshed');
            
            // Update analytics view
            if (window.dashboard && window.dashboard.renderAnalytics) {
                window.dashboard.renderAnalytics(data);
            }
            
            return data;
        } catch (error) {
            console.error('Error refreshing analytics:', error);
            this.showError('Failed to refresh analytics data. Please refresh the page.');
            return null;
        }
    }
    
    static async refreshCompare() {
        try {
            console.log('Refreshing compare view...');
            const response = await fetch('http://localhost:3001/api/candidates/assessments', {
                headers: { 
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}` 
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            console.log('Compare data refreshed:', data.length, 'candidates with assessments');
            
            // Update compare view
            if (window.dashboard && window.dashboard.renderCompare) {
                window.dashboard.renderCompare(data);
            }
            
            return data;
        } catch (error) {
            console.error('Error refreshing compare:', error);
            this.showError('Failed to refresh compare data. Please refresh the page.');
            return null;
        }
    }
    
    static async refreshAIDashboard() {
        try {
            console.log('Refreshing AI Dashboard...');
            
            // Refresh the AI Dashboard's candidate list
            if (window.aiDashboard && window.aiDashboard.loadCandidatesList) {
                await window.aiDashboard.loadCandidatesList();
            }
            
            return true;
        } catch (error) {
            console.error('Error refreshing AI Dashboard:', error);
            this.showError('Failed to refresh AI Dashboard. Please refresh the page.');
            return null;
        }
    }
    
    static showError(message) {
        // Show user-friendly error message
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #dc3545;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        notification.textContent = message;
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }
    
    static showLoading(show = true) {
        let loader = document.getElementById('dashboard-loader');
        
        if (show && !loader) {
            loader = document.createElement('div');
            loader.id = 'dashboard-loader';
            loader.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(255,255,255,0.8);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 9999;
            `;
            loader.innerHTML = `
                <div style="text-align: center;">
                    <div style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 40px; height: 40px; animation: spin 2s linear infinite; margin: 0 auto 10px;"></div>
                    <p>Loading...</p>
                </div>
            `;
            
            // Add spin animation
            const style = document.createElement('style');
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
            
            document.body.appendChild(loader);
        } else if (!show && loader) {
            loader.remove();
        }
    }
}

// Listen for candidate import events
window.addEventListener('candidateImported', async (event) => {
    console.log('Candidate imported event received:', event.detail);
    
    // Show loading state
    DashboardDataManager.showLoading(true);
    
    try {
        // Refresh all views
        await DashboardDataManager.refreshAllViews();
        
        // Show success message
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        notification.textContent = `Candidate ${event.detail.candidateId} imported successfully!`;
        document.body.appendChild(notification);
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
        
    } catch (error) {
        console.error('Error refreshing views after import:', error);
        DashboardDataManager.showError('Failed to refresh views after import');
    } finally {
        // Hide loading state
        DashboardDataManager.showLoading(false);
    }
});

// Make it globally available
window.DashboardDataManager = DashboardDataManager;

