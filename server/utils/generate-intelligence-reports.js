const intelligenceService = require('../services/intelligenceService');
const db = require('../config/database');

async function generateIntelligenceReports() {
    console.log('Generating intelligence reports for existing completed assessments...');
    
    try {
        // Get all completed assessments
        const assessments = await db.query(`
            SELECT a.id, a.candidate_id, c.first_name, c.last_name
            FROM assessments a
            JOIN candidates c ON a.candidate_id = c.id
            WHERE a.status = 'completed'
        `);
        
        console.log(`Found ${assessments.rows.length} completed assessments`);
        
        for (const assessment of assessments.rows) {
            console.log(`Processing assessment for ${assessment.first_name}...`);
            
            // Get dimension scores
            const scores = await db.query(`
                SELECT dimension, score
                FROM dimension_scores
                WHERE assessment_id = $1
            `, [assessment.id]);
            
            // Get framework mappings
            const mappings = await db.query(`
                SELECT framework, result
                FROM framework_mappings
                WHERE assessment_id = $1
            `, [assessment.id]);
            
            // Generate intelligence report
            const report = await intelligenceService.generateIntelligenceReport(
                assessment.id,
                scores.rows,
                mappings.rows
            );
            
            console.log(`✅ Generated intelligence report for ${assessment.first_name}`);
        }
        
        console.log('All intelligence reports generated successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Error generating intelligence reports:', error);
        process.exit(1);
    }
}

generateIntelligenceReports();

