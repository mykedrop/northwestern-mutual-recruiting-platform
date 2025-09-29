class AIDashboard {
    constructor() {
        this.baseURL = 'http://localhost:3001'; // Backend URL
        this.container = null;
        this.chatSessionId = null;
        this.isInitialized = false;
    }

    initialize() {
        this.container = document.getElementById('ai-dashboard');
        if (!this.container) {
            console.error('AI Dashboard container not found');
            return false;
        }
        
        this.render();
        this.attachEventListeners();
        this.loadMetrics();
        
        // Load candidates list with a small delay to ensure DOM is ready
        setTimeout(() => {
            this.loadCandidatesList();
        }, 100);
        
        this.isInitialized = true;
        return true;
    }

    render() {
        if (!this.container) {
            console.error('Cannot render AI Dashboard: container not found');
            return;
        }

        // ALWAYS render the full dashboard structure
        this.container.innerHTML = `
            <div class="ai-dashboard-wrapper">
                <!-- Demo Mode Toggle (only for demo user) -->
                <div id="demo-mode-banner" style="display: none; background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h3 style="margin: 0 0 5px 0; color: #856404;">🎭 DEMO MODE</h3>
                            <p style="margin: 0; color: #856404; font-size: 14px;">Showing simulated data for demonstration purposes</p>
                        </div>
                        <label style="display: flex; align-items: center; gap: 10px; cursor: pointer;">
                            <span style="font-size: 14px; color: #856404;">Demo Mode:</span>
                            <input type="checkbox" id="demo-mode-toggle" style="width: 40px; height: 20px; cursor: pointer;">
                        </label>
                    </div>
                </div>

                <!-- Intelligent AI Assistant -->
                <div class="dashboard-section">
                    <h2>🤖 AI Recruiting Assistant</h2>
                    <p style="color: #666; margin-bottom: 15px;">Ask me anything about your candidates, pipeline, or recruiting needs</p>

                    <!-- Quick Action Buttons -->
                    <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
                        <button class="btn-secondary" onclick="window.aiDashboard.quickQuery('Show me top 5 candidates')" style="padding: 6px 12px; font-size: 13px;">
                            🏆 Top Candidates
                        </button>
                        <button class="btn-secondary" onclick="window.aiDashboard.quickQuery('What are the pipeline bottlenecks?')" style="padding: 6px 12px; font-size: 13px;">
                            ⚠️ Pipeline Issues
                        </button>
                        <button class="btn-secondary" onclick="window.aiDashboard.quickQuery('Show candidates in Philadelphia')" style="padding: 6px 12px; font-size: 13px;">
                            📍 By Location
                        </button>
                    </div>

                    <div class="chatbot-container" style="height: 400px;">
                        <div class="chat-messages" id="chat-messages" style="flex: 1; overflow-y: auto; padding: 16px; background: #f9f9f9;"></div>
                        <div class="chat-input-container" style="display: flex; padding: 12px; border-top: 1px solid #ddd;">
                            <input type="text" id="chat-input" placeholder="Ask: 'Show me top 5 candidates in Chicago'" style="flex: 1; padding: 8px 12px; border: 1px solid #ddd; border-radius: 20px; margin-right: 8px;">
                            <button id="send-message" style="padding: 8px 20px; background: #2196F3; color: white; border: none; border-radius: 20px; cursor: pointer;">Send</button>
                        </div>
                    </div>
                </div>

                <!-- Real-Time Metrics -->
                <div class="dashboard-section">
                    <h2>📊 Intelligence Metrics</h2>
                    <div id="ai-metrics" class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                        <div class="stat-card">
                            <div class="stat-value" id="metric-total">--</div>
                            <div class="stat-label">Total Candidates</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="metric-avg-score">--</div>
                            <div class="stat-label">Avg Assessment Score</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="metric-top-matches">--</div>
                            <div class="stat-label">Top Matches (80%+)</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value" id="metric-completed">--</div>
                            <div class="stat-label">Completed Assessments</div>
                        </div>
                    </div>
                </div>

                <!-- Resume Upload Section -->
                <div class="dashboard-section">
                    <h2>AI-Powered Sourcing</h2>
                    <div class="sourcing-controls">
                        <div class="upload-resume">
                            <label for="resume-upload" class="upload-btn">
                                <i class="fas fa-upload"></i> Upload Resume
                            </label>
                            <input type="file" id="resume-upload" accept=".pdf,.doc,.docx,.txt" hidden>
                        </div>
                        <button class="btn-primary" id="search-candidates">
                            <i class="fas fa-search"></i> Search Similar Candidates
                        </button>
                    </div>
                    <div id="sourcing-results" class="results-container">
                        <p style="text-align: center; color: #666; padding: 20px;">
                            Upload a resume to get started with AI-powered candidate sourcing
                        </p>
                    </div>
                </div>

                <!-- Recent Candidates Section -->
                <div class="dashboard-section">
                    <h2>Recent AI-Sourced Candidates</h2>
                    <div style="margin-bottom: 15px;">
                        <button onclick="window.aiDashboard.refreshCandidatesList()" class="btn-secondary" style="padding: 8px 16px; font-size: 14px;">
                            <i class="fas fa-sync-alt"></i> Refresh List
                        </button>
                    </div>
                    <div id="recent-candidates-list">
                        <p style="text-align: center; color: #666; padding: 20px;">
                            Loading candidates...
                        </p>
                    </div>
                </div>

                <!-- Interview Intelligence -->
                <div class="dashboard-section">
                    <h2>Interview Intelligence</h2>
                    <button class="btn-primary" id="generate-questions">
                        Generate Interview Questions
                    </button>
                    <div id="interview-questions" class="questions-container"></div>
                </div>
            </div>
        `;
    }

    attachEventListeners() {
        if (!this.container) {
            console.error('Cannot attach event listeners: container not found');
            return;
        }
        
        // Resume upload
        const resumeUpload = document.getElementById('resume-upload');
        if (resumeUpload) {
            resumeUpload.addEventListener('change', (e) => {
                this.handleResumeUpload(e.target.files[0]);
            });
        }

        // Search candidates
        const searchCandidates = document.getElementById('search-candidates');
        if (searchCandidates) {
            searchCandidates.addEventListener('click', () => {
                this.searchSimilarCandidates();
            });
        }

        // Predictions
        const predictButtons = document.querySelectorAll('[data-predict]');
        predictButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.generatePrediction(e.target.dataset.predict);
            });
        });

        // Chatbot
        const sendMessage = document.getElementById('send-message');
        if (sendMessage) {
            sendMessage.addEventListener('click', () => {
                this.sendChatMessage();
            });
        }

        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.sendChatMessage();
            });
        }

        // Interview questions
        const generateQuestions = document.getElementById('generate-questions');
        if (generateQuestions) {
            generateQuestions.addEventListener('click', () => {
                this.generateInterviewQuestions();
            });
        }

        // Email campaign
        const createCampaign = document.getElementById('create-campaign');
        if (createCampaign) {
            createCampaign.addEventListener('click', () => {
                this.showCampaignModal();
            });
        }
    }

    // Helper method for API calls
    async apiCall(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const token = localStorage.getItem('accessToken');
        
        const defaultOptions = {
            headers: {
                'Authorization': token ? `Bearer ${token}` : '',
                ...options.headers
            }
        };

        // Don't set Content-Type for FormData
        if (!(options.body instanceof FormData)) {
            defaultOptions.headers['Content-Type'] = 'application/json';
        }

        try {
            const response = await fetch(url, { ...defaultOptions, ...options });
            
            if (!response.ok) {
                const error = await response.text();
                throw new Error(error || `HTTP ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    async handleResumeUpload(file) {
        const formData = new FormData();
        formData.append('resume', file);

        try {
            const result = await this.apiCall('/api/v3/ai/parse-resume', {
                method: 'POST',
                body: formData
            });
            
            if (result.success) {
                this.showNotification('Resume parsed successfully!', 'success');
                this.displayParsedResume(result.data);
            } else {
                throw new Error(result.error || 'Failed to parse resume');
            }
        } catch (error) {
            console.error('Resume upload error:', error);
            this.showNotification('Failed to parse resume: ' + error.message, 'error');
        }
    }

    displayParsedResume(data) {
        const resultsContainer = document.getElementById('sourcing-results');
        if (!resultsContainer) return;
        
        // Store the data for later use
        this.lastParsedData = data;
        
        resultsContainer.innerHTML = `
            <div class="parsed-resume">
                <h3>${data.name}</h3>
                <p><strong>Email:</strong> ${data.email}</p>
                <p><strong>Phone:</strong> ${data.phone || 'Not found'}</p>
                <p><strong>Title:</strong> ${data.currentTitle || 'Not specified'}</p>
                <p><strong>Experience:</strong> ${data.yearsExperience || data.experience || 0} years</p>
                <div class="skills-tags">
                    ${(data.skills || []).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                </div>
                <button class="btn-primary" id="import-candidate-btn">
                    Import as Candidate
                </button>
            </div>
        `;
        
        // Add event listener the proper way
        const importBtn = document.getElementById('import-candidate-btn');
        if (importBtn) {
            importBtn.addEventListener('click', () => {
                this.importCandidate(this.lastParsedData);
            });
        }
    }

    async importCandidate(candidateData) {
        try {
            // Show loading state
            const importBtn = document.getElementById('import-candidate-btn');
            if (importBtn) {
                importBtn.textContent = 'Importing...';
                importBtn.disabled = true;
                importBtn.style.backgroundColor = '#ff9800';
            }

            // Parse the data if it's a string
            if (typeof candidateData === 'string') {
                candidateData = JSON.parse(candidateData);
            }

            console.log('Importing candidate:', candidateData);

            const response = await this.apiCall('/api/candidates', {
                method: 'POST',
                body: JSON.stringify({
                    first_name: candidateData.name.split(' ')[0] || 'Unknown',
                    last_name: candidateData.name.split(' ').slice(1).join(' ') || '',
                    email: candidateData.email,
                    phone: candidateData.phone || '',
                    status: 'new',
                    source: 'resume_upload',
                    skills: candidateData.skills || [],
                    years_experience: candidateData.yearsExperience || candidateData.experience || 0
                })
            });

            console.log('Import response:', response);

            if (response.id || response.success) {
                console.log('Import response received:', response);
                
                // Store the new candidate ID in sessionStorage for tracking
                sessionStorage.setItem('lastImportedCandidateId', response.id);
                
                // OPTIMISTIC UI UPDATE - Add candidate to list immediately
                if (response.candidate) {
                    this.addCandidateToList(response.candidate);
                }
                
                // Show success message WITHOUT redirect
                this.showNotification('Candidate imported successfully!', 'success');
                
                // Update button to show success
                if (importBtn) {
                    importBtn.textContent = '✓ Imported Successfully';
                    importBtn.style.backgroundColor = '#4CAF50';
                    importBtn.style.color = 'white';
                }
                
                // Show import confirmation in the UI WITHOUT redirect
                this.showImportSuccess(candidateData, response.id);
                
                // Dispatch custom event for other components to refresh
                window.dispatchEvent(new CustomEvent('candidateImported', { 
                    detail: { candidateId: response.id, candidate: response.candidate } 
                }));
                
                // Verify and refresh data in background
                setTimeout(async () => {
                    try {
                        const verifyResponse = await this.apiCall('/api/candidates', {
                            method: 'GET'
                        });
                        
                        const foundCandidate = verifyResponse.find(c => c.id === response.id);
                        if (!foundCandidate) {
                            console.error('CRITICAL: Candidate saved but not found in list!');
                            this.showNotification('Warning: Candidate may not have saved properly', 'warning');
                        } else {
                            console.log('Candidate verified in database:', foundCandidate);
                        }
                        
                        // Refresh the list with latest data
                        this.loadCandidatesList(true);
                    } catch (error) {
                        console.error('Error verifying candidate:', error);
                    }
                }, 2000);
            } else {
                throw new Error('Unexpected response format');
            }
        } catch (error) {
            console.error('Import candidate error:', error);
            
            // Reset button
            const importBtn = document.getElementById('import-candidate-btn');
            if (importBtn) {
                importBtn.textContent = 'Import as Candidate';
                importBtn.disabled = false;
                importBtn.style.backgroundColor = '#007bff';
                importBtn.style.color = 'white';
            }
            
            // Show specific error message
            let errorMessage = 'Failed to import candidate';
            if (error.message.includes('duplicate key')) {
                errorMessage = 'This candidate already exists (duplicate email)';
            } else if (error.message.includes('already exists')) {
                errorMessage = 'This candidate already exists in the system';
            } else if (error.message) {
                errorMessage = error.message;
            }
            
            this.showNotification(errorMessage, 'error');
        }
    }

    showImportSuccess(candidateData, responseId) {
        const resultsContainer = document.getElementById('sourcing-results');
        if (!resultsContainer) return;
        
        resultsContainer.innerHTML = `
            <div class="import-success">
                <div class="success-header">
                    <h3>✅ Candidate Imported Successfully!</h3>
                    <p class="success-message">Your candidate has been added to the system and is ready for review.</p>
                </div>
                <div class="imported-candidate-card">
                    <div class="candidate-info">
                        <h4>${candidateData.name || 'Unknown Name'}</h4>
                        <p><strong>ID:</strong> ${responseId || 'N/A'}</p>
                        <p><strong>Email:</strong> ${candidateData.email || 'Not provided'}</p>
                        <p><strong>Phone:</strong> ${candidateData.phone || 'Not provided'}</p>
                        <p><strong>Status:</strong> Active in pipeline</p>
                        <p><strong>Source:</strong> Resume Upload</p>
                    </div>
                    <div class="skills-preview">
                        <strong>Skills:</strong>
                        <div class="skills-tags">
                            ${(candidateData.skills || []).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button onclick="window.aiDashboard.navigateToCandidates()" class="btn-primary">
                            View in Candidates Tab
                        </button>
                        <button onclick="window.location.reload()" class="btn-secondary">
                            Import Another Resume
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add some styling for the success view
        const style = document.createElement('style');
        style.textContent = `
            .import-success {
                background: #f8f9fa;
                border: 2px solid #4CAF50;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .success-header h3 {
                color: #4CAF50;
                margin: 0 0 10px 0;
            }
            .success-message {
                color: #666;
                margin: 0 0 20px 0;
            }
            .imported-candidate-card {
                background: white;
                border-radius: 6px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .candidate-info p {
                margin: 8px 0;
                color: #333;
            }
            .skills-preview {
                margin: 15px 0;
            }
            .action-buttons {
                margin-top: 20px;
                display: flex;
                gap: 10px;
            }
            .btn-primary, .btn-secondary {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }
            .btn-primary {
                background: #007bff;
                color: white;
            }
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            .btn-primary:hover {
                background: #0056b3;
            }
            .btn-secondary:hover {
                background: #545b62;
            }
        `;
        if (!document.getElementById('import-success-styles')) {
            style.id = 'import-success-styles';
            document.head.appendChild(style);
        }
    }

    showImportConfirmation(candidateData, response) {
        const resultsContainer = document.getElementById('sourcing-results');
        if (!resultsContainer) return;
        
        // Store current candidate data for manual name correction
        this.currentCandidateData = candidateData;
        this.currentCandidateId = response.id || response;
        
        // Check if name extraction failed - be very aggressive about detecting failures
        const nameExtracted = candidateData.name && 
                             candidateData.name !== 'Unknown Name' && 
                             !candidateData.name.toLowerCase().includes('mfweingarten') &&
                             !candidateData.name.toLowerCase().includes('launch') &&
                             !candidateData.name.toLowerCase().includes('profitable') &&
                             !candidateData.name.toLowerCase().includes('reinvestment') &&
                             !candidateData.name.toLowerCase().includes('long-term') &&
                             !candidateData.name.toLowerCase().includes('growth') &&
                             !candidateData.name.toLowerCase().includes('for') &&
                             !candidateData.name.toLowerCase().includes('term') &&
                             candidateData.name.split(' ').length <= 4 && // Names shouldn't be too long
                             candidateData.name.split(' ').length >= 2 && // Names should have at least 2 words
                             /^[A-Za-z\s.-]+$/.test(candidateData.name); // Should only contain letters, spaces, dots, hyphens
        
        // Debug logging
        console.log('Name extraction debug:', {
            name: candidateData.name,
            nameExtracted: nameExtracted,
            wordCount: candidateData.name ? candidateData.name.split(' ').length : 0,
            containsReinvestment: candidateData.name ? candidateData.name.toLowerCase().includes('reinvestment') : false,
            containsFor: candidateData.name ? candidateData.name.toLowerCase().includes('for') : false,
            containsTerm: candidateData.name ? candidateData.name.toLowerCase().includes('term') : false
        });
        
        // Force manual input for suspicious names
        const suspiciousName = candidateData.name && (
            candidateData.name.toLowerCase().includes('reinvestment') ||
            candidateData.name.toLowerCase().includes('long-term') ||
            candidateData.name.toLowerCase().includes('growth') ||
            candidateData.name.toLowerCase().includes('for') ||
            candidateData.name.toLowerCase().includes('term') ||
            candidateData.name.split(' ').length > 4
        );
        
        const shouldShowManualInput = !nameExtracted || suspiciousName;
        
        resultsContainer.innerHTML = `
            <div class="import-success">
                <div class="success-header">
                    <h3>✅ Candidate Imported Successfully!</h3>
                    <p class="success-message">Your candidate has been added to the system and is ready for review.</p>
                </div>
                <div class="imported-candidate-card">
                    <div class="candidate-info">
                        <h4>
                            <span id="candidate-name">${candidateData.name}</span>
                            ${shouldShowManualInput ? '<button onclick="window.aiDashboard.showManualNameInput()" class="btn-correct-name" style="margin-left: 10px; padding: 4px 8px; background: #ffc107; color: #212529; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;"><i class="fas fa-edit"></i> Correct Name</button>' : ''}
                        </h4>
                        ${shouldShowManualInput ? `
                        <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; padding: 10px; margin: 10px 0;">
                            <strong style="color: #856404;">⚠️ Name Extraction Failed</strong>
                            <p style="margin: 5px 0; color: #856404; font-size: 14px;">The system couldn't extract a proper name from your resume. Please enter the correct name below:</p>
                            <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
                                <input type="text" id="manual-first-name" placeholder="First Name" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                                <input type="text" id="manual-last-name" placeholder="Last Name" style="flex: 1; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 4px; font-size: 14px;">
                                <button onclick="window.aiDashboard.applyManualName()" class="btn-primary" style="padding: 8px 16px; font-size: 14px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                    <i class="fas fa-check"></i> Apply
                                </button>
                            </div>
                        </div>
                        ` : ''}
                        <p><strong>ID:</strong> ${response.id || response}</p>
                        <p><strong>Email:</strong> ${candidateData.email}</p>
                        <p><strong>Phone:</strong> ${candidateData.phone || 'Not provided'}</p>
                        <p><strong>Status:</strong> Active in pipeline</p>
                        <p><strong>Source:</strong> Resume Upload</p>
                    </div>
                    <div class="skills-preview">
                        <strong>Skills:</strong>
                        <div class="skills-tags">
                            ${(candidateData.skills || []).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button onclick="window.aiDashboard.navigateToCandidates()" class="btn-primary">
                            View in Candidates Tab
                        </button>
                        <button onclick="window.location.reload()" class="btn-secondary">
                            Import Another Resume
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add some styling for the success view
        const style = document.createElement('style');
        style.textContent = `
            .import-success {
                background: #f8f9fa;
                border: 2px solid #4CAF50;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
            }
            .success-header h3 {
                color: #4CAF50;
                margin: 0 0 10px 0;
            }
            .success-message {
                color: #666;
                margin: 0 0 20px 0;
            }
            .imported-candidate-card {
                background: white;
                border-radius: 6px;
                padding: 20px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .candidate-info p {
                margin: 8px 0;
                color: #333;
            }
            .skills-preview {
                margin: 15px 0;
            }
            .action-buttons {
                margin-top: 20px;
                display: flex;
                gap: 10px;
            }
            .btn-primary, .btn-secondary {
                padding: 10px 20px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: 500;
            }
            .btn-primary {
                background: #007bff;
                color: white;
            }
            .btn-secondary {
                background: #6c757d;
                color: white;
            }
            .btn-primary:hover {
                background: #0056b3;
            }
            .btn-secondary:hover {
                background: #545b62;
            }
        `;
        if (!document.getElementById('import-success-styles')) {
            style.id = 'import-success-styles';
            document.head.appendChild(style);
        }
    }

    navigateToCandidates() {
        console.log('Navigating to candidates view...');
        
        // Method 1: Try to find and click the candidates navigation button
        const candidatesNav = document.querySelector('[data-view="candidates"]');
        if (candidatesNav) {
            console.log('Found candidates nav button, clicking...');
            candidatesNav.click();
            return;
        }
        
        // Method 2: Try to find candidates link
        const candidatesLink = document.querySelector('a[href="#candidates"]');
        if (candidatesLink) {
            console.log('Found candidates link, clicking...');
            candidatesLink.click();
            return;
        }
        
        // Method 3: Try to trigger dashboard view switch
        if (window.dashboard && typeof window.dashboard.switchView === 'function') {
            console.log('Using dashboard.switchView...');
            window.dashboard.switchView('candidates');
            return;
        }
        
        // Method 4: Try to trigger showView function
        if (typeof window.showView === 'function') {
            console.log('Using window.showView...');
            window.showView('candidates');
            return;
        }
        
        // Method 5: Force reload to candidates page
        console.log('Using fallback: reloading to candidates page...');
        window.location.href = '/dashboard.html#candidates';
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }

    resetForNewImport() {
        const resultsContainer = document.getElementById('sourcing-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <div class="upload-prompt">
                    <h3>Upload a Resume to Get Started</h3>
                    <p>Drag and drop a resume file here or click to browse</p>
                </div>
            `;
        }
        
        // Reset the file input
        const fileInput = document.getElementById('resume-upload');
        if (fileInput) {
            fileInput.value = '';
        }
        
        this.showNotification('Ready to import another resume!', 'info');
    }

    async searchSimilarCandidates() {
        const candidateId = this.getCurrentCandidateId();
        
        try {
            const response = await fetch('/api/v3/ai/find-similar', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({ candidateId })
            });

            const result = await response.json();
            
            if (result.success) {
                this.displaySimilarCandidates(result.similar);
            }
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    async generatePrediction(type) {
        const candidateId = this.getCurrentCandidateId();
        
        try {
            const response = await fetch(`/api/v3/ai/predict/${type}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
                },
                body: JSON.stringify({ candidateId })
            });

            const result = await response.json();
            
            if (result.success) {
                this.displayPrediction(type, result.prediction);
            }
        } catch (error) {
            console.error('Prediction error:', error);
        }
    }

    displayPrediction(type, prediction) {
        if (type === 'success') {
            const scoreElement = document.getElementById('success-score');
            scoreElement.innerHTML = `
                <div class="score-value">${Math.round(prediction.successProbability * 100)}%</div>
                <div class="score-label">${prediction.recommendation.replace('_', ' ')}</div>
            `;
            scoreElement.className = `prediction-score ${prediction.recommendation}`;
        } else if (type === 'retention') {
            const scoreElement = document.getElementById('retention-score');
            scoreElement.innerHTML = `
                <div class="score-value">${Math.round(prediction.retention_probability['1_year'] * 100)}%</div>
                <div class="risk-factors">
                    ${prediction.risk_factors.map(f => `<span class="risk-tag">${f}</span>`).join('')}
                </div>
            `;
        }
    }

    async sendChatMessage() {
        const input = document.getElementById('chat-input');
        const message = input.value.trim();

        if (!message) return;

        // Add user message to chat
        this.addChatMessage('user', message);
        input.value = '';

        // Show typing indicator
        const typingId = this.addChatMessage('assistant', '...');

        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const result = await this.apiCall('/api/v3/ai/intelligent-query', {
                method: 'POST',
                body: JSON.stringify({
                    query: message,
                    user
                })
            });

            // Remove typing indicator
            const typingMsg = document.getElementById(typingId);
            if (typingMsg) typingMsg.remove();

            if (result.success) {
                // Show demo mode indicator if applicable
                const responseText = result.isDemoMode
                    ? `🎭 [Demo Mode]\n\n${result.response}`
                    : result.response;

                this.addChatMessage('assistant', responseText);

                // If there's candidate data, show it
                if (result.data && Array.isArray(result.data) && result.data.length > 0) {
                    this.displayQueryResults(result.data);
                }
            } else {
                this.addChatMessage('assistant', 'Sorry, I encountered an error. Please try again.');
            }
        } catch (error) {
            console.error('Chat error:', error);
            const typingMsg = document.getElementById(typingId);
            if (typingMsg) typingMsg.remove();
            this.addChatMessage('assistant', 'Sorry, I encountered an error. Please try again.');
        }
    }

    quickQuery(query) {
        const input = document.getElementById('chat-input');
        if (input) {
            input.value = query;
            this.sendChatMessage();
        }
    }

    displayQueryResults(candidates) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'query-results';
        resultsDiv.style.cssText = 'margin: 10px 0; padding: 15px; background: white; border-radius: 8px; border: 1px solid #e0e0e0;';

        resultsDiv.innerHTML = `
            <h4 style="margin: 0 0 10px 0;">Candidate Results:</h4>
            ${candidates.slice(0, 5).map(c => `
                <div style="padding: 10px; margin: 5px 0; background: #f5f5f5; border-radius: 4px; border-left: 3px solid ${c.score >= 90 ? '#4CAF50' : c.score >= 80 ? '#8BC34A' : '#FFC107'};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <strong>${c.first_name} ${c.last_name}</strong>
                            ${c.location ? `<span style="color: #666; font-size: 12px;"> • ${c.location}</span>` : ''}
                        </div>
                        <span style="font-weight: bold; color: ${c.score >= 90 ? '#4CAF50' : c.score >= 80 ? '#8BC34A' : '#FFC107'};">${Math.round(c.score || 0)}%</span>
                    </div>
                    ${c.skills && c.skills.length > 0 ? `
                        <div style="margin-top: 5px; font-size: 12px; color: #666;">
                            Skills: ${(Array.isArray(c.skills) ? c.skills : []).slice(0, 3).join(', ')}
                        </div>
                    ` : ''}
                </div>
            `).join('')}
        `;

        container.appendChild(resultsDiv);
        container.scrollTop = container.scrollHeight;
    }

    addChatMessage(role, content) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        const messageId = `msg-${Date.now()}`;
        messageDiv.id = messageId;
        messageDiv.className = `chat-message ${role}`;
        messageDiv.innerHTML = `
            <div class="message-content" style="max-width: 70%; padding: 10px 14px; border-radius: 18px; background: ${role === 'user' ? '#2196F3' : 'white'}; color: ${role === 'user' ? 'white' : '#333'}; box-shadow: 0 1px 2px rgba(0,0,0,0.1); white-space: pre-wrap;">${content}</div>
            <div class="message-time" style="font-size: 11px; color: #999; margin-top: 4px;">${new Date().toLocaleTimeString()}</div>
        `;
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        return messageId;
    }

    async generateInterviewQuestions() {
        const candidateId = this.getCurrentCandidateId();
        
        try {
            const result = await this.apiCall('/api/v3/ai/interview/generate-questions', {
                method: 'POST',
                body: JSON.stringify({
                    candidateId,
                    role: 'Financial Advisor'
                })
            });
            
            if (result.success) {
                this.displayInterviewQuestions(result.questions);
            }
        } catch (error) {
            console.error('Question generation error:', error);
        }
    }

    displayInterviewQuestions(questions) {
        const container = document.getElementById('interview-questions');
        container.innerHTML = `
            <div class="questions-list">
                <h3>AI-Generated Interview Questions</h3>
                ${questions.map((q, i) => `
                    <div class="question-item">
                        <span class="question-number">${i + 1}.</span>
                        <span class="question-text">${q}</span>
                    </div>
                `).join('')}
                <button class="btn-secondary" onclick="aiDashboard.copyQuestions()">
                    Copy All Questions
                </button>
            </div>
        `;
    }

    copyQuestions() {
        const questions = Array.from(document.querySelectorAll('.question-text'))
            .map(el => el.textContent)
            .join('\n\n');
        
        navigator.clipboard.writeText(questions);
        this.showNotification('Questions copied to clipboard!', 'success');
    }

    getCurrentCandidateId() {
        // Get from URL params or selected candidate
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get('candidateId') || '1';
    }

    showNotification(message, type = 'info') {
        // Remove any existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 6px;
            color: white;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: slideIn 0.3s ease-out;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            max-width: 400px;
            word-wrap: break-word;
        `;
        
        // Add animation styles if not already present
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds with animation
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    async loadMetrics() {
        try {
            const result = await this.apiCall('/api/v3/ai/dashboard-metrics');

            if (result.success && result.metrics) {
                const m = result.metrics;
                document.getElementById('metric-total').textContent = m.totalCandidates;
                document.getElementById('metric-avg-score').textContent = `${m.avgScore}%`;
                document.getElementById('metric-top-matches').textContent = m.topMatches;
                document.getElementById('metric-completed').textContent = m.completedAssessments;

                // Show demo mode banner if applicable
                if (result.isDemoMode) {
                    const banner = document.getElementById('demo-mode-banner');
                    if (banner) banner.style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Failed to load metrics:', error);
        }
    }

    displayMetrics(metrics) {
        console.log('AI Metrics:', metrics);
    }

    addCandidateToList(candidate) {
        console.log('Adding candidate to list optimistically:', candidate);
        
        const container = document.getElementById('recent-candidates-list');
        if (!container) return;
        
        // Create candidate card
        const candidateCard = document.createElement('div');
        candidateCard.className = 'candidate-card';
        candidateCard.style.cssText = `
            background: #f5f5f5; 
            padding: 15px; 
            margin: 10px; 
            border-radius: 8px; 
            border: 1px solid #ddd;
            animation: slideIn 0.3s ease-out;
        `;
        
        candidateCard.innerHTML = `
            <h4 style="margin: 0 0 8px 0; color: #212529;">${candidate.first_name} ${candidate.last_name}</h4>
            <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Email:</strong> ${candidate.email}</p>
            <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Phone:</strong> ${candidate.phone || 'Not provided'}</p>
            <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Status:</strong> ${candidate.pipeline_stage || 'In Pipeline - Applied Stage'}</p>
            <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Source:</strong> ${candidate.source || 'Resume Upload'}</p>
            <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Added:</strong> ${new Date(candidate.created_at).toLocaleDateString()}</p>
            <button onclick="window.location.href='/dashboard.html#candidates'" style="background: #2196F3; color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; margin-top: 8px;">
                View in Candidates
            </button>
        `;
        
        // Add slide-in animation CSS if not already added
        if (!document.getElementById('slide-in-styles')) {
            const style = document.createElement('style');
            style.id = 'slide-in-styles';
            style.textContent = `
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Insert at the top of the list
        if (container.firstChild) {
            container.insertBefore(candidateCard, container.firstChild);
        } else {
            container.appendChild(candidateCard);
        }
        
        // Limit to 5 candidates
        const cards = container.querySelectorAll('.candidate-card');
        if (cards.length > 5) {
            cards[cards.length - 1].remove();
        }
    }

    async loadCandidatesList(forceRefresh = false) {
        try {
            console.log('Loading recent candidates for AI Dashboard...', forceRefresh ? '(force refresh)' : '');
            const response = await this.apiCall('/api/candidates', {
                method: 'GET'
            });
            
            const container = document.getElementById('recent-candidates-list');
            
            if (!container) {
                console.error('Recent candidates container not found');
                return;
            }
            
            if (response && response.length > 0) {
                console.log('Found', response.length, 'candidates, displaying latest 5');
                container.innerHTML = response.slice(0, 5).map(c => `
                    <div class="candidate-card" style="background: #f5f5f5; padding: 15px; margin: 10px; border-radius: 8px; border: 1px solid #ddd;">
                        <h4 style="margin: 0 0 8px 0; color: #212529;">${c.first_name} ${c.last_name}</h4>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Email:</strong> ${c.email}</p>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Phone:</strong> ${c.phone || 'Not provided'}</p>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Status:</strong> ${c.pipeline_stage || 'In Pipeline - Applied Stage'}</p>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Source:</strong> ${c.source || 'Resume Upload'}</p>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Added:</strong> ${new Date(c.created_at).toLocaleDateString()}</p>
                        <button onclick="window.location.href='/dashboard.html#candidates'" style="background: #2196F3; color: white; padding: 5px 10px; border: none; border-radius: 4px; cursor: pointer; margin-top: 8px;">
                            View in Candidates
                        </button>
                    </div>
                `).join('');
            } else {
                console.log('No candidates found, showing empty state');
                container.innerHTML = '<p style="text-align: center; color: #666; padding: 20px;">No candidates imported yet. Upload a resume to get started!</p>';
            }
        } catch (error) {
            console.error('Failed to load candidates:', error);
            const container = document.getElementById('recent-candidates-list');
            if (container) {
                container.innerHTML = '<p style="text-align: center; color: #dc3545; padding: 20px;">Error loading candidates. Check console for details.</p>';
            }
        }
    }
    
    // Force refresh the candidates list
    async refreshCandidatesList() {
        console.log('Force refreshing candidates list...');
        await this.loadCandidatesList(true);
    }

    showManualNameInput() {
        const manualInput = document.getElementById('manual-name-input');
        if (manualInput) {
            manualInput.style.display = 'block';
        }
    }

    hideManualNameInput() {
        const manualInput = document.getElementById('manual-name-input');
        if (manualInput) {
            manualInput.style.display = 'none';
        }
    }

    applyManualName() {
        const firstName = document.getElementById('manual-first-name').value.trim();
        const lastName = document.getElementById('manual-last-name').value.trim();
        
        if (!firstName || !lastName) {
            this.showNotification('Please enter both first and last name', 'error');
            return;
        }
        
        // Update the current candidate data with manual name
        if (this.currentCandidateData) {
            this.currentCandidateData.first_name = firstName;
            this.currentCandidateData.last_name = lastName;
            this.currentCandidateData.name = `${firstName} ${lastName}`;
            
            // Update the display
            const nameElement = document.getElementById('candidate-name');
            if (nameElement) {
                nameElement.textContent = `${firstName} ${lastName}`;
            }
            
            this.hideManualNameInput();
            this.showNotification('Name updated successfully!', 'success');
        }
    }

    displayCandidatesList(candidates) {
        const container = document.getElementById('ai-dashboard');
        if (!container) return;
        
        // Add a section for recent candidates
        const candidatesSection = document.createElement('div');
        candidatesSection.className = 'dashboard-section';
        candidatesSection.style.cssText = `
            background: #f8f9fa;
            padding: 20px;
            margin: 20px 0;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        `;
        candidatesSection.innerHTML = `
            <h2 style="color: #495057; margin-bottom: 15px;">📋 Recent AI-Sourced Candidates</h2>
            <div class="candidates-list">
                ${candidates.map(candidate => `
                    <div class="candidate-card" style="
                        background: white; 
                        padding: 15px; 
                        margin: 10px 0; 
                        border-radius: 6px;
                        border-left: 4px solid #007bff;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    ">
                        <h4 style="margin: 0 0 8px 0; color: #212529;">${candidate.first_name} ${candidate.last_name}</h4>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Email:</strong> ${candidate.email}</p>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Phone:</strong> ${candidate.phone || 'Not provided'}</p>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Status:</strong> In Pipeline - Applied Stage</p>
                        <p style="margin: 4px 0; color: #6c757d; font-size: 14px;"><strong>Source:</strong> ${candidate.source || 'Resume Upload'}</p>
                        <button onclick="window.location.href='/dashboard.html#candidates'" 
                                style="
                                    background: #007bff; 
                                    color: white; 
                                    padding: 8px 16px; 
                                    border: none; 
                                    border-radius: 4px; 
                                    cursor: pointer; 
                                    font-size: 14px;
                                    margin-top: 10px;
                                ">
                            View in Candidates
                        </button>
                    </div>
                `).join('')}
            </div>
            <div style="text-align: center; margin-top: 15px;">
                <button onclick="window.location.href='/dashboard.html#candidates'" 
                        style="
                            background: #28a745; 
                            color: white; 
                            padding: 10px 20px; 
                            border: none; 
                            border-radius: 4px; 
                            cursor: pointer; 
                            font-size: 16px;
                        ">
                    View All Candidates
                </button>
            </div>
        `;
        
        // Insert after the sourcing section
        const sourcingSection = container.querySelector('.dashboard-section');
        if (sourcingSection && sourcingSection.nextSibling) {
            container.insertBefore(candidatesSection, sourcingSection.nextSibling);
        } else {
            container.appendChild(candidatesSection);
        }
    }
}

// Create global instance and expose on window for inline handlers
let aiDashboard = new AIDashboard();
window.aiDashboard = aiDashboard;
