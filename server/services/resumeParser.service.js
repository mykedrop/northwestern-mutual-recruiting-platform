const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');
const Tesseract = require('tesseract.js');
const openAIService = require('./openai.service');

class ResumeParserService {
    constructor() {
        this.supportedFormats = ['.pdf', '.docx', '.doc', '.txt'];
    }

    async parseResume(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (!this.supportedFormats.includes(ext)) {
            throw new Error(`Unsupported file format: ${ext}`);
        }

        let text = '';

        try {
            switch (ext) {
                case '.pdf':
                    text = await this.parsePDF(filePath);
                    break;
                case '.docx':
                case '.doc':
                    text = await this.parseWord(filePath);
                    break;
                case '.txt':
                    text = await this.parseText(filePath);
                    break;
            }

            // Use GPT-4 to extract structured data
            const structuredData = await openAIService.parseResume(text);
            
            // Generate embedding for the entire resume
            const embedding = await openAIService.generateEmbedding(text);
            
            return {
                rawText: text,
                structured: structuredData,
                embedding: embedding
            };
        } catch (error) {
            console.error('Resume parsing error:', error);
            throw error;
        }
    }

    async parsePDF(filePath) {
        const dataBuffer = await fs.readFile(filePath);
        const data = await pdfParse(dataBuffer);
        
        // If text extraction fails, try OCR
        if (!data.text || data.text.trim().length < 100) {
            return await this.performOCR(filePath);
        }
        
        return data.text;
    }

    async parseWord(filePath) {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }

    async parseText(filePath) {
        return await fs.readFile(filePath, 'utf8');
    }

    async performOCR(filePath) {
        const { data: { text } } = await Tesseract.recognize(
            filePath,
            'eng',
            {
                logger: m => console.log(m)
            }
        );
        return text;
    }

    extractSkills(text) {
        // Common technical skills - extend this list
        const skillPatterns = [
            'javascript', 'python', 'java', 'react', 'node.js', 'sql',
            'aws', 'docker', 'kubernetes', 'machine learning', 'ai',
            'project management', 'agile', 'scrum', 'leadership',
            'communication', 'problem solving', 'analytical'
        ];

        const foundSkills = [];
        const lowerText = text.toLowerCase();

        skillPatterns.forEach(skill => {
            if (lowerText.includes(skill)) {
                foundSkills.push(skill);
            }
        });

        return foundSkills;
    }

    calculateMatchScore(candidateData, jobRequirements) {
        let score = 0;
        let maxScore = 0;

        // Skills matching (40% weight)
        const requiredSkills = jobRequirements.skills || [];
        const candidateSkills = candidateData.skills || [];
        
        requiredSkills.forEach(skill => {
            maxScore += 40 / requiredSkills.length;
            if (candidateSkills.some(s => s.toLowerCase().includes(skill.toLowerCase()))) {
                score += 40 / requiredSkills.length;
            }
        });

        // Experience matching (30% weight)
        maxScore += 30;
        const requiredExp = jobRequirements.minExperience || 0;
        const candidateExp = candidateData.yearsExperience || 0;
        
        if (candidateExp >= requiredExp) {
            score += 30;
        } else if (candidateExp >= requiredExp - 1) {
            score += 20;
        } else if (candidateExp >= requiredExp - 2) {
            score += 10;
        }

        // Education matching (20% weight)
        maxScore += 20;
        if (jobRequirements.education && candidateData.education) {
            const hasRequiredEducation = candidateData.education.some(edu => 
                edu.degree && jobRequirements.education.some(req => 
                    edu.degree.toLowerCase().includes(req.toLowerCase())
                )
            );
            if (hasRequiredEducation) score += 20;
        }

        // Location matching (10% weight)
        maxScore += 10;
        if (jobRequirements.location && candidateData.location) {
            if (candidateData.location.toLowerCase().includes(jobRequirements.location.toLowerCase())) {
                score += 10;
            }
        }

        return Math.round((score / maxScore) * 100);
    }
}

module.exports = new ResumeParserService();

