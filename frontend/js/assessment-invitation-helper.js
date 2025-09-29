/**
 * Assessment Invitation Helper - Frontend JavaScript
 * Easy functions to integrate assessment invitations into your recruiting platform
 */

class AssessmentInvitationHelper {
    constructor(apiBaseUrl = '/api', authToken = null) {
        this.apiBaseUrl = apiBaseUrl;
        this.authToken = authToken;
    }

    // Set auth token for API calls
    setAuthToken(token) {
        this.authToken = token;
    }

    // Helper method for API calls
    async apiCall(endpoint, method = 'GET', data = null) {
        const config = {
            method,
            headers: {
                'Content-Type': 'application/json',
                ...(this.authToken && { 'Authorization': `Bearer ${this.authToken}` })
            }
        };

        if (data && (method === 'POST' || method === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        const response = await fetch(`${this.apiBaseUrl}${endpoint}`, config);
        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || 'API call failed');
        }

        return result;
    }

    /**
     * COMPLETE WORKFLOW: Add candidate and send assessment invitation
     * Use this when adding candidates from sourcing or manual entry
     */
    async addCandidateAndSendAssessment(candidateData, sendInvitation = true) {
        try {
            // Step 1: Add candidate to system
            console.log('Adding candidate to system...');
            const candidateResponse = await this.apiCall('/candidates', 'POST', candidateData);

            if (!candidateResponse.success) {
                throw new Error('Failed to add candidate');
            }

            const candidateId = candidateResponse.id;
            console.log(`✅ Candidate added with ID: ${candidateId}`);

            if (!sendInvitation) {
                return {
                    success: true,
                    candidateId,
                    candidate: candidateResponse.candidate,
                    message: 'Candidate added successfully'
                };
            }

            // Step 2: Send assessment invitation
            console.log('Sending assessment invitation...');
            const invitationResponse = await this.sendAssessmentInvitation(candidateId);

            return {
                success: true,
                candidateId,
                candidate: candidateResponse.candidate,
                invitation: invitationResponse.data,
                assessmentUrl: invitationResponse.data.assessmentUrl,
                message: 'Candidate added and assessment invitation sent!'
            };

        } catch (error) {
            console.error('Add candidate and send assessment error:', error);
            throw error;
        }
    }

    /**
     * Send professional email invitation to existing candidate
     */
    async sendAssessmentInvitation(candidateId, customSubject = null) {
        try {
            const payload = { candidateId };
            if (customSubject) {
                payload.customSubject = customSubject;
            }

            const response = await this.apiCall('/assessment-invitations/send', 'POST', payload);

            console.log(`✅ Assessment invitation sent to candidate ${candidateId}`);
            return response;

        } catch (error) {
            console.error('Send invitation error:', error);
            throw error;
        }
    }

    /**
     * Generate assessment link without sending email (for manual sharing)
     */
    async generateAssessmentLink(candidateId) {
        try {
            const response = await this.apiCall('/assessment-invitations/generate-link', 'POST', {
                candidateId
            });

            console.log(`✅ Assessment link generated for candidate ${candidateId}`);
            return response.assessmentUrl;

        } catch (error) {
            console.error('Generate link error:', error);
            throw error;
        }
    }

    /**
     * Get assessment info for candidate card display
     */
    async getCandidateAssessmentInfo(candidateId) {
        try {
            const response = await this.apiCall(`/assessment-invitations/candidate-link/${candidateId}`);
            return {
                assessmentUrl: response.assessmentUrl,
                assessmentStatus: response.assessmentStatus,
                invitationStatus: response.invitationStatus
            };

        } catch (error) {
            console.error('Get candidate assessment info error:', error);
            // Return defaults if error (candidate might not have assessment yet)
            return {
                assessmentUrl: null,
                assessmentStatus: 'not_started',
                invitationStatus: null
            };
        }
    }

    /**
     * Get invitation status and tracking info
     */
    async getInvitationStatus(invitationId) {
        try {
            const response = await this.apiCall(`/assessment-invitations/status/${invitationId}`);
            return response;

        } catch (error) {
            console.error('Get invitation status error:', error);
            throw error;
        }
    }

    /**
     * Resend invitation to candidate
     */
    async resendInvitation(invitationId) {
        try {
            const response = await this.apiCall(`/assessment-invitations/resend/${invitationId}`, 'POST');
            console.log(`✅ Assessment invitation resent (${invitationId})`);
            return response;

        } catch (error) {
            console.error('Resend invitation error:', error);
            throw error;
        }
    }

    /**
     * Get all invitations for current recruiter
     */
    async getMyInvitations(status = null, limit = 50) {
        try {
            const params = new URLSearchParams({ limit: limit.toString() });
            if (status) params.append('status', status);

            const response = await this.apiCall(`/assessment-invitations/my-invitations?${params}`);
            return response.invitations;

        } catch (error) {
            console.error('Get my invitations error:', error);
            throw error;
        }
    }

    /**
     * Get invitation analytics for recruiter dashboard
     */
    async getInvitationAnalytics() {
        try {
            const response = await this.apiCall('/assessment-invitations/analytics');
            return response.analytics;

        } catch (error) {
            console.error('Get invitation analytics error:', error);
            throw error;
        }
    }
}

// Usage Examples:

/**
 * EXAMPLE 1: Add candidate from sourcing and send invitation
 */
async function addCandidateFromSourcing(candidateData) {
    const helper = new AssessmentInvitationHelper('/api', getAuthToken());

    try {
        const result = await helper.addCandidateAndSendAssessment({
            first_name: candidateData.firstName,
            last_name: candidateData.lastName,
            email: candidateData.email,
            phone: candidateData.phone,
            source: 'linkedin_search',
            skills: candidateData.skills,
            years_experience: candidateData.experience
        });

        // Show success message to user
        showSuccessMessage(`✅ ${result.candidate.first_name} added and assessment invitation sent!`);

        // Update UI with assessment URL
        updateCandidateCard(result.candidateId, {
            assessmentUrl: result.assessmentUrl,
            status: 'assessment_invited'
        });

        return result;

    } catch (error) {
        showErrorMessage(`❌ Failed to add candidate: ${error.message}`);
        throw error;
    }
}

/**
 * EXAMPLE 2: Send assessment to existing candidate
 */
async function sendAssessmentToCandidate(candidateId) {
    const helper = new AssessmentInvitationHelper('/api', getAuthToken());

    try {
        const result = await helper.sendAssessmentInvitation(candidateId);

        showSuccessMessage(`✅ Assessment invitation sent successfully!`);

        // Update candidate card status
        updateCandidateCardStatus(candidateId, 'assessment_invited');

        return result;

    } catch (error) {
        if (error.message.includes('Active invitation already exists')) {
            showWarningMessage('⚠️ Assessment invitation already sent to this candidate');
        } else {
            showErrorMessage(`❌ Failed to send invitation: ${error.message}`);
        }
        throw error;
    }
}

/**
 * EXAMPLE 3: Update candidate card with assessment info
 */
async function updateCandidateCardWithAssessment(candidateId, cardElement) {
    const helper = new AssessmentInvitationHelper('/api', getAuthToken());

    try {
        const assessmentInfo = await helper.getCandidateAssessmentInfo(candidateId);

        // Update the candidate card UI
        const statusElement = cardElement.querySelector('.assessment-status');
        const linkElement = cardElement.querySelector('.assessment-link');
        const actionButton = cardElement.querySelector('.assessment-action-btn');

        if (assessmentInfo.assessmentStatus === 'not_started') {
            statusElement.textContent = 'No Assessment';
            actionButton.textContent = 'Send Assessment';
            actionButton.onclick = () => sendAssessmentToCandidate(candidateId);

        } else if (assessmentInfo.assessmentStatus === 'in_progress') {
            statusElement.textContent = 'Assessment In Progress';
            linkElement.href = assessmentInfo.assessmentUrl;
            linkElement.style.display = 'inline';
            actionButton.textContent = 'View Assessment';
            actionButton.onclick = () => window.open(assessmentInfo.assessmentUrl, '_blank');

        } else if (assessmentInfo.assessmentStatus === 'completed') {
            statusElement.textContent = 'Assessment Completed ✅';
            actionButton.textContent = 'View Results';
            actionButton.onclick = () => viewAssessmentResults(candidateId);
        }

    } catch (error) {
        console.error('Failed to update candidate card:', error);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssessmentInvitationHelper;
} else if (typeof window !== 'undefined') {
    window.AssessmentInvitationHelper = AssessmentInvitationHelper;
}

// Utility functions (implement these based on your UI framework)
function getAuthToken() {
    // Return your JWT token from localStorage, cookie, or state management
    return localStorage.getItem('authToken') || '';
}

function showSuccessMessage(message) {
    // Implement your success notification UI
    console.log('SUCCESS:', message);
}

function showErrorMessage(message) {
    // Implement your error notification UI
    console.error('ERROR:', message);
}

function showWarningMessage(message) {
    // Implement your warning notification UI
    console.warn('WARNING:', message);
}

function updateCandidateCard(candidateId, data) {
    // Update your candidate card UI with new data
    console.log('Update candidate card:', candidateId, data);
}

function updateCandidateCardStatus(candidateId, status) {
    // Update candidate card status display
    console.log('Update candidate status:', candidateId, status);
}

function viewAssessmentResults(candidateId) {
    // Navigate to assessment results page
    window.location.href = `/dashboard/candidates/${candidateId}/assessment-results`;
}