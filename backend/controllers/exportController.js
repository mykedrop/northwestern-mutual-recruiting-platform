const PDFDocument = require('pdfkit');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const exportPDF = async (req, res) => {
    try {
        const { candidateIds } = req.body;
        const recruiterId = req.user.userId;
        
        // Create export log
        const exportId = uuidv4();
        const exportPath = path.join(__dirname, '..', 'exports', `${exportId}.pdf`);
        
        await db.query(
            `INSERT INTO export_logs (id, recruiter_id, export_type, filters, file_path, status) 
             VALUES ($1, $2, 'pdf', $3, $4, 'processing')`,
            [exportId, recruiterId, JSON.stringify({ candidateIds }), exportPath]
        );
        
        // Create PDF
        const doc = new PDFDocument();
        doc.pipe(fs.createWriteStream(exportPath));
        
        // Add header
        doc.fontSize(20).text('Northwestern Mutual - Candidate Assessment Report', 50, 50);
        doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, 50, 80);
        
        // Process each candidate
        for (const candidateId of candidateIds) {
            // Get candidate data
            const candidate = await db.query(
                `SELECT * FROM candidates WHERE id = $1 AND recruiter_id = $2`,
                [candidateId, recruiterId]
            );
            
            if (candidate.rows.length === 0) continue;
            
            const candidateData = candidate.rows[0];
            
            // Get assessment data
            const assessment = await db.query(
                `SELECT * FROM assessments WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [candidateId]
            );
            
            if (assessment.rows.length === 0) continue;
            
            // Get scores
            const scores = await db.query(
                `SELECT * FROM dimension_scores WHERE assessment_id = $1`,
                [assessment.rows[0].id]
            );
            
            // Add candidate section
            doc.addPage();
            doc.fontSize(16).text(`${candidateData.first_name} ${candidateData.last_name}`, 50, 50);
            doc.fontSize(10).text(`Email: ${candidateData.email}`, 50, 75);
            doc.fontSize(10).text(`Assessment Date: ${assessment.rows[0].created_at}`, 50, 90);
            
            // Add scores
            doc.fontSize(14).text('Dimensional Scores:', 50, 120);
            let yPosition = 145;
            
            scores.rows.forEach(score => {
                doc.fontSize(10).text(
                    `${score.dimension.replace(/_/g, ' ')}: ${score.score.toFixed(1)} (${score.percentile}th percentile)`,
                    70,
                    yPosition
                );
                yPosition += 15;
            });
        }
        
        doc.end();
        
        // Update export status
        await db.query(
            `UPDATE export_logs SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [exportId]
        );
        
        res.json({ exportId, status: 'processing' });
    } catch (error) {
        console.error('Export PDF error:', error);
        res.status(500).json({ error: 'Failed to export PDF' });
    }
};

const exportCSV = async (req, res) => {
    try {
        const { filters } = req.body;
        const recruiterId = req.user.userId;
        
        // Create export log
        const exportId = uuidv4();
        const exportPath = path.join(__dirname, '..', 'exports', `${exportId}.csv`);
        
        await db.query(
            `INSERT INTO export_logs (id, recruiter_id, export_type, filters, file_path, status) 
             VALUES ($1, $2, 'csv', $3, $4, 'processing')`,
            [exportId, recruiterId, JSON.stringify(filters), exportPath]
        );
        
        // Get data
        const candidates = await db.query(`
            SELECT 
                c.*,
                a.status as assessment_status,
                a.completion_percentage,
                a.start_time,
                a.end_time
            FROM candidates c
            LEFT JOIN assessments a ON a.candidate_id = c.id
            WHERE c.recruiter_id = $1
            ORDER BY c.created_at DESC
        `, [recruiterId]);
        
        // Create CSV
        const csvWriter = createCsvWriter({
            path: exportPath,
            header: [
                { id: 'first_name', title: 'First Name' },
                { id: 'last_name', title: 'Last Name' },
                { id: 'email', title: 'Email' },
                { id: 'assessment_status', title: 'Assessment Status' },
                { id: 'completion_percentage', title: 'Completion %' },
                { id: 'created_at', title: 'Added Date' }
            ]
        });
        
        await csvWriter.writeRecords(candidates.rows);
        
        // Update export status
        await db.query(
            `UPDATE export_logs SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [exportId]
        );
        
        res.json({ exportId, status: 'processing' });
    } catch (error) {
        console.error('Export CSV error:', error);
        res.status(500).json({ error: 'Failed to export CSV' });
    }
};

const getExportStatus = async (req, res) => {
    try {
        const { exportId } = req.params;
        const recruiterId = req.user.userId;
        
        const result = await db.query(
            `SELECT * FROM export_logs WHERE id = $1 AND recruiter_id = $2`,
            [exportId, recruiterId]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Export not found' });
        }
        
        const exportLog = result.rows[0];
        
        if (exportLog.status === 'completed') {
            // Read file and send
            const filePath = exportLog.file_path;
            const fileContent = fs.readFileSync(filePath);
            
            res.setHeader('Content-Type', exportLog.export_type === 'pdf' ? 'application/pdf' : 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=export.${exportLog.export_type}`);
            res.send(fileContent);
        } else {
            res.json({ status: exportLog.status });
        }
    } catch (error) {
        console.error('Get export status error:', error);
        res.status(500).json({ error: 'Failed to get export status' });
    }
};

module.exports = {
    exportPDF,
    exportCSV,
    getExportStatus
};
