const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

async function seedDatabase() {
    console.log('Starting database seed...');
    
    try {
        // Get existing recruiter or create one
        let recruiterId;
        const existingRecruiter = await db.query(
            'SELECT id FROM recruiters WHERE email = $1',
            ['demo@northwestern.com']
        );
        
        if (existingRecruiter.rows.length > 0) {
            recruiterId = existingRecruiter.rows[0].id;
            console.log('Using existing demo recruiter');
        } else {
            recruiterId = uuidv4();
            const passwordHash = await bcrypt.hash('password123', 10);
            
            await db.query(
                `INSERT INTO recruiters (id, email, password_hash, first_name, last_name) 
                 VALUES ($1, $2, $3, $4, $5)`,
                [recruiterId, 'demo@northwestern.com', passwordHash, 'Demo', 'Recruiter']
            );
            console.log('Created demo recruiter (email: demo@northwestern.com, password: password123)');
        }
        
        // Create some test candidates
        const candidateIds = [];
        const candidateData = [
            { firstName: 'John', lastName: 'Smith', email: 'john.smith@example.com' },
            { firstName: 'Sarah', lastName: 'Johnson', email: 'sarah.j@example.com' },
            { firstName: 'Michael', lastName: 'Brown', email: 'mbrown@example.com' },
            { firstName: 'Emily', lastName: 'Davis', email: 'emily.davis@example.com' },
            { firstName: 'David', lastName: 'Wilson', email: 'dwilson@example.com' }
        ];
        
        for (const candidate of candidateData) {
            const candidateId = uuidv4();
            candidateIds.push(candidateId);
            
            await db.query(
                `INSERT INTO candidates (id, email, first_name, last_name, recruiter_id) 
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (email) DO NOTHING`,
                [candidateId, candidate.email, candidate.firstName, candidate.lastName, recruiterId]
            );
        }
        
        console.log(`Created ${candidateIds.length} test candidates`);
        
        // Create some assessments with different statuses
        for (let i = 0; i < 3; i++) {
            const assessmentId = uuidv4();
            const status = i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'not_started';
            const completionPercentage = i === 0 ? 100 : i === 1 ? 60 : 0;
            
            await db.query(
                `INSERT INTO assessments (id, candidate_id, status, completion_percentage, start_time) 
                 VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
                [assessmentId, candidateIds[i], status, completionPercentage]
            );
            
            if (status === 'completed') {
                // Add dimension scores for completed assessment
                const dimensions = [
                    'cognitive_flexibility',
                    'emotional_regulation',
                    'social_calibration',
                    'achievement_drive',
                    'learning_orientation',
                    'risk_tolerance',
                    'relationship_building',
                    'ethical_reasoning',
                    'influence_style',
                    'systems_thinking',
                    'self_management',
                    'collaborative_intelligence'
                ];
                
                for (const dimension of dimensions) {
                    const score = 60 + Math.random() * 40; // Random score between 60-100
                    const percentile = Math.floor(score * 0.9);
                    
                    await db.query(
                        `INSERT INTO dimension_scores (assessment_id, dimension, score, percentile) 
                         VALUES ($1, $2, $3, $4)`,
                        [assessmentId, dimension, score, percentile]
                    );
                }
                
                // Add framework mappings
                const frameworks = [
                    { framework: 'MBTI', result: 'INTJ' },
                    { framework: 'Big Five', result: 'High Openness-Conscientiousness' },
                    { framework: 'DISC', result: 'D' },
                    { framework: 'Enneagram', result: 'Type 3' }
                ];
                
                for (const mapping of frameworks) {
                    await db.query(
                        `INSERT INTO framework_mappings (assessment_id, framework, result, confidence) 
                         VALUES ($1, $2, $3, $4)`,
                        [assessmentId, mapping.framework, mapping.result, 0.85]
                    );
                }
            }
        }
        
        console.log('Created test assessments with scores');
        
        // Assign candidates to pipeline stages
        const pipelineStages = await db.query('SELECT id, name FROM pipeline_stages ORDER BY order_position');
        
        // Assign candidates to different pipeline stages
        const stageAssignments = [
            { candidateIndex: 0, stageName: 'Assessment Complete' }, // John Smith - completed assessment
            { candidateIndex: 1, stageName: 'Interview Scheduled' },  // Sarah Johnson - in progress
            { candidateIndex: 2, stageName: 'Applied' },             // Michael Brown - not started
            { candidateIndex: 3, stageName: 'Assessment Sent' },     // Emily Davis - new
            { candidateIndex: 4, stageName: 'Reference Check' }      // David Wilson - advanced
        ];
        
        for (const assignment of stageAssignments) {
            const candidateId = candidateIds[assignment.candidateIndex];
            const stage = pipelineStages.rows.find(s => s.name === assignment.stageName);
            
            if (stage) {
                await db.query(
                    `INSERT INTO candidate_pipeline (candidate_id, stage_id, moved_by, notes, moved_at)
                     VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)`,
                    [candidateId, stage.id, recruiterId, `Seeded to ${assignment.stageName} stage`]
                );
            }
        }
        
        console.log('Assigned candidates to pipeline stages');
        
        // Add some notifications
        await db.query(
            `INSERT INTO notifications (recruiter_id, type, title, message) 
             VALUES ($1, $2, $3, $4)`,
            [
                recruiterId,
                'assessment_complete',
                'Assessment Completed',
                'John Smith has completed their assessment'
            ]
        );
        
        console.log('Database seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
