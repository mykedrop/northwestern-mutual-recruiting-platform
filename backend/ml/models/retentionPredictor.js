const db = require('../../db');

class RetentionPredictionModel {
    constructor() {
        this.features = [];
        this.model = null;
    }

    async predict(candidateData) {
        // Simplified retention prediction logic
        // In production, this would use a trained sklearn model via Python API
        
        const riskFactors = [];
        let riskScore = 0;

        // Commute distance factor
        if (candidateData.commuteDistance > 45) {
            riskScore += 20;
            riskFactors.push('Long commute distance');
        }

        // Salary expectations
        if (candidateData.salaryExpectations > candidateData.offeredSalary * 1.1) {
            riskScore += 25;
            riskFactors.push('Salary expectations mismatch');
        }

        // Career trajectory alignment
        if (!candidateData.careerGoalsAligned) {
            riskScore += 15;
            riskFactors.push('Career goals not aligned');
        }

        // Previous job tenure pattern
        const avgTenure = candidateData.previousRoles.reduce((sum, role) => 
            sum + role.duration, 0) / candidateData.previousRoles.length;
        
        if (avgTenure < 1.5) {
            riskScore += 20;
            riskFactors.push('History of short tenures');
        }

        // Calculate retention probabilities
        const baseRetention = 1 - (riskScore / 100);
        
        return {
            retention_probability: {
                '6_months': Math.max(0.5, baseRetention),
                '1_year': Math.max(0.4, baseRetention - 0.1),
                '2_years': Math.max(0.3, baseRetention - 0.2)
            },
            risk_factors: riskFactors,
            risk_score: riskScore,
            interventions: this.generateInterventions(riskFactors)
        };
    }

    generateInterventions(riskFactors) {
        const interventions = [];

        if (riskFactors.includes('Long commute distance')) {
            interventions.push('Consider remote work options');
            interventions.push('Flexible hours to avoid peak traffic');
        }

        if (riskFactors.includes('Salary expectations mismatch')) {
            interventions.push('Clear performance-based raise structure');
            interventions.push('Additional non-monetary benefits');
        }

        if (riskFactors.includes('Career goals not aligned')) {
            interventions.push('Create personalized development plan');
            interventions.push('Assign mentor from desired career path');
        }

        if (riskFactors.includes('History of short tenures')) {
            interventions.push('Enhanced onboarding program');
            interventions.push('30-60-90 day check-ins');
            interventions.push('Early engagement initiatives');
        }

        return interventions;
    }

    async saveTrainingData(candidateId, actualRetention) {
        // Save actual retention data for model retraining
        await db.query(
            `INSERT INTO ml_training_data 
            (candidate_id, features, labels, data_version)
            VALUES ($1, $2, $3, $4)`,
            [
                candidateId,
                JSON.stringify(this.features),
                JSON.stringify({ retained: actualRetention }),
                '1.0'
            ]
        );
    }
}

module.exports = new RetentionPredictionModel();

