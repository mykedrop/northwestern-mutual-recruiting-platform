// Behavioral Analysis Module - Elite Assessment
class BehavioralAnalyzer {
    constructor() {
        this.responsePatterns = [];
        this.timingData = [];
        this.consistencyMarkers = [];
    }
    
    recordResponse(questionId, responseTime, selectedIndex) {
        this.responsePatterns.push({
            questionId,
            responseTime,
            selectedIndex,
            timestamp: Date.now()
        });
    }
    
    analyzeConsistency() {
        // Check for patterns indicating genuine engagement
        const avgResponseTime = this.responsePatterns.reduce((sum, r) => sum + r.responseTime, 0) / this.responsePatterns.length;
        
        return {
            averageResponseTime: avgResponseTime,
            consistencyScore: this.calculateConsistencyScore(),
            engagementLevel: this.assessEngagement()
        };
    }
    
    calculateConsistencyScore() {
        // Simple consistency check - are answers varied appropriately?
        const uniqueResponses = new Set(this.responsePatterns.map(r => r.selectedIndex)).size;
        return Math.min(100, (uniqueResponses / this.responsePatterns.length) * 150);
    }
    
    assessEngagement() {
        const veryQuickResponses = this.responsePatterns.filter(r => r.responseTime < 3000).length;
        if (veryQuickResponses > 10) return 'Low';
        if (veryQuickResponses > 5) return 'Moderate';
        return 'High';
    }
}

class DimensionalScorer {
    constructor() {
        this.dimensions = ['client_advocacy', 'ethical_flexibility', 'emotional_durability', 'strategic_thinking', 'social_intelligence'];
    }
    
    calculateScores(responses) {
        const scores = {};
        this.dimensions.forEach(dim => {
            scores[dim] = this.calculateDimensionScore(responses, dim);
        });
        return scores;
    }
    
    calculateDimensionScore(responses, dimension) {
        const relevantResponses = responses.filter(r => r.dimension === dimension);
        if (relevantResponses.length === 0) return 0;
        
        const total = relevantResponses.reduce((sum, r) => sum + r.weight, 0);
        return Math.round((total / relevantResponses.length) * 100);
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { BehavioralAnalyzer, DimensionalScorer };
} else {
    window.BehavioralAnalyzer = BehavioralAnalyzer;
    window.DimensionalScorer = DimensionalScorer;
}

