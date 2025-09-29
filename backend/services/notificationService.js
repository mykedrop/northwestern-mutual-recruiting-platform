const db = require('../config/database');

const notifyAssessmentComplete = async (recruiterId, candidate) => {
    const title = `Assessment Completed`;
    const message = `${candidate.first_name} ${candidate.last_name} has completed their assessment`;
    
    await db.query(
        `INSERT INTO notifications (recruiter_id, type, title, message, data) 
         VALUES ($1, $2, $3, $4, $5)`,
        [
            recruiterId,
            'assessment_complete',
            title,
            message,
            JSON.stringify({
                candidateId: candidate.id,
                candidateName: `${candidate.first_name} ${candidate.last_name}`,
                completedAt: new Date().toISOString()
            })
        ]
    );
    
    return true;
};

const notifyHighPerformer = async (recruiterId, candidate, scores) => {
    const avgScore = scores.reduce((sum, s) => sum + s.score, 0) / scores.length;
    
    if (avgScore > 80) {
        const title = `High Performer Alert`;
        const message = `${candidate.first_name} ${candidate.last_name} scored in the top 20% with an average of ${avgScore.toFixed(1)}`;
        
        await db.query(
            `INSERT INTO notifications (recruiter_id, type, title, message, data) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
                recruiterId,
                'high_performer',
                title,
                message,
                JSON.stringify({
                    candidateId: candidate.id,
                    avgScore,
                    topDimensions: scores.sort((a, b) => b.score - a.score).slice(0, 3)
                })
            ]
        );
    }
};

const notifyRedFlag = async (recruiterId, candidate, dimension, score) => {
    if (score < 30) {
        const title = `Red Flag Alert`;
        const message = `${candidate.first_name} ${candidate.last_name} scored low on ${dimension.replace(/_/g, ' ')}`;
        
        await db.query(
            `INSERT INTO notifications (recruiter_id, type, title, message, data) 
             VALUES ($1, $2, $3, $4, $5)`,
            [
                recruiterId,
                'red_flag',
                title,
                message,
                JSON.stringify({
                    candidateId: candidate.id,
                    dimension,
                    score
                })
            ]
        );
    }
};

module.exports = {
    notifyAssessmentComplete,
    notifyHighPerformer,
    notifyRedFlag
};
