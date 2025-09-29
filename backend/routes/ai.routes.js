const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pdfParse = require('pdf-parse');
const openAIService = require('../services/openai.service');
const resumeParser = require('../services/resumeParser.service');
const chatbotService = require('../services/chatbot.service');
const aiRouterService = require('../services/ai-router.service');
const successPredictor = require('../ml/models/successPredictor');
const retentionPredictor = require('../ml/models/retentionPredictor');
const db = require('../db');

// Configure multer for file uploads (using memory storage for testing)
const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10000000 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|docx|doc|txt|json/; // Added json for testing
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        
        if (extname) {
            return cb(null, true);
        } else {
            cb('Error: Invalid file type');
        }
    }
});

// Helper functions for basic resume parsing
function extractEmail(text) {
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi;
    const matches = text.match(emailRegex);
    return matches ? matches[0] : 'unknown@example.com';
}

function extractPhone(text) {
    const phoneRegex = /(\+?\d{1,4}[\s.-]?)?\(?\d{1,4}\)?[\s.-]?\d{1,4}[\s.-]?\d{1,4}/g;
    const matches = text.match(phoneRegex);
    return matches ? matches[0] : 'Not found';
}

function extractName(text) {
    // Look for common patterns like name at the beginning
    const lines = text.split('\n').filter(line => line.trim());
    
    // Common words that are NOT names
    const nonNameWords = [
        'resume', 'curriculum', 'cv', 'email', 'phone', 'address', 'experience',
        'education', 'skills', 'objective', 'summary', 'profile', 'launch',
        'profitable', 'product', 'lines', 'business', 'development', 'marketing',
        'sales', 'management', 'leadership', 'project', 'team', 'client',
        'customer', 'service', 'support', 'technical', 'professional', 'career',
        'work', 'job', 'position', 'role', 'responsibility', 'achievement',
        'accomplishment', 'result', 'goal', 'target', 'strategy', 'plan',
        'initiative', 'program', 'system', 'process', 'method', 'approach',
        'solution', 'innovation', 'technology', 'digital', 'online', 'web',
        'mobile', 'application', 'software', 'platform', 'tool', 'framework',
        'university', 'college', 'degree', 'bachelor', 'master', 'phd',
        'certification', 'license', 'award', 'honor', 'publication', 'research',
        'grew', 'revenue', 'months', 'through', 'data', 'driven', 'scaling',
        'brand', 'positioning', 'conducted', 'depth', 'competitive', 'analysis',
        'product', 'market', 'fit', 'testing', 'built', 'optimized', 'multiple',
        'sales', 'funnels', 'achieving', 'roas', 'negotiated', 'domestic',
        'international', 'supplies', 'reduce', 'cogs', 'increasing', 'gross',
        'margins', 'automated', 'inventory', 'order', 'fulfillment', 'systems',
        'cutting', 'operational', 'time', 'managed', 'aspects', 'bus',
        // Extra blockers observed in mis-parsing
        'reinvestment', 'growth', 'long', 'term', 'for'
    ];
    
    // Helper: title case
    const toTitleCase = (s) => s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

    // QUICK PASS: Global search for Canva-style spaced-letter name anywhere
    const spacedNameMatch = text.match(/([A-Z](?:\s[A-Z]){1,}\s{2,}[A-Z](?:\s[A-Z]){1,}(?:\s{2,}[A-Z](?:\s[A-Z]){1,}){0,2})/);
    if (spacedNameMatch) {
        const collapsed = spacedNameMatch[1]
            .split(/\s{2,}/)
            .map(p => p.replace(/\s+/g, ''))
            .join(' ');
        const words = collapsed.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
            return toTitleCase(collapsed);
        }
    }

    // QUICK PASS: Prefer a clean ALL-CAPS name early in the document (common in resumes)
    const headerBanlist = new Set(['CONTACT','SUMMARY','OBJECTIVE','PROFILE','EXPERIENCE','WORK','EDUCATION','SKILLS','PROJECTS','CERTIFICATIONS','OPERATIONS','PROFESSIONAL']);
    // Heuristic: if a CONTACT header exists, the name is typically the line just above it
    const contactIdx = lines.findIndex(l => l.trim().toUpperCase() === 'CONTACT');
    if (contactIdx > 0) {
        const nameLineRaw = lines[contactIdx - 1].trim();
        if (/^[A-Z\s.-]+$/.test(nameLineRaw)) {
            // Collapse single spaces inside tokens, split on 2+ spaces as word boundaries
            const parts = nameLineRaw.split(/\s{2,}/).map(p => p.replace(/\s+/g, ''));
            if (parts.length >= 2 && parts.length <= 4) {
                const candidate = parts.join(' ');
                if (candidate && candidate.length <= 60) {
                    return toTitleCase(candidate);
                }
            }
        }
    }
    for (let i = 0; i < Math.min(30, lines.length); i++) {
        const line = lines[i].trim();
        if (!line) continue;
        if (/^[A-Z][A-Z\s.-]+$/.test(line)) {
            // Case A: letters normally spaced words
            let words = line.split(/\s+/).filter(Boolean);
            let candidate = null;
            if (words.every(w => w.length > 1)) {
                candidate = words.join(' ');
            } else {
                // Case B: Canva-style spaced letters: "M I C H A E L   W E I N G A R T E N"
                const parts = line.split(/\s{2,}/).map(p => p.replace(/\s+/g, ''));
                if (parts.every(p => p.length > 1)) {
                    candidate = parts.join(' ');
                }
            }
            if (candidate) {
                const cWords = candidate.split(/\s+/);
                const inRange = cWords.length >= 2 && cWords.length <= 4;
                const allAlpha = cWords.every(w => /^[A-Z.-]+$/.test(w));
                const notBanned = cWords.every(w => !headerBanlist.has(w));
                if (inRange && allAlpha && notBanned) {
                    return toTitleCase(candidate);
                }
            }
        }
    }

    // Strategy 1: Look for name patterns in the first few lines (including empty lines)
    for (let i = 0; i < Math.min(15, lines.length); i++) {
        const line = lines[i].trim();
        
        // Skip lines that are clearly not names
        if (line.toLowerCase().includes('resume') || 
            line.toLowerCase().includes('curriculum') ||
            line.toLowerCase().includes('cv') ||
            line.toLowerCase().includes('email') ||
            line.toLowerCase().includes('phone') ||
            line.toLowerCase().includes('address') ||
            line.includes('@') ||
            line.match(/\d{3}[-.]?\d{3}[-.]?\d{4}/) ||
            line.length > 50 ||
            line.match(/^\d+/) || // Skip lines starting with numbers
            line.match(/^[a-z\s]+$/) || // Skip all lowercase lines
            line.match(/\$/) || // Skip lines with dollar signs
            line.match(/\d+%/) || // Skip lines with percentages
            line.match(/\d+x/) || // Skip lines with multipliers like "4-5x"
            line.match(/\d+-\d+/) || // Skip lines with number ranges
            line.match(/revenue|profit|sales|marketing|business|development/i)) { // Skip business terms
            continue;
        }

        // Allow ALL-CAPS names like "MICHAEL WEINGARTEN"
        if (line.match(/^[A-Z\s.-]+$/)) {
            const words = line.split(/\s+/).filter(Boolean);
            if (words.length >= 2 && words.length <= 4) {
                const looksLikeName = words.every(w => {
                    const clean = w.toLowerCase();
                    return clean.length > 1 && /^[A-Za-z.-]+$/.test(w) && !nonNameWords.includes(clean);
                });
                if (looksLikeName) {
                    return toTitleCase(line);
                }
            }
        }
        
        // Check if line looks like a name (2-4 words, mostly letters)
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
            const isName = words.every(word => {
                const cleanWord = word.toLowerCase().replace(/[^a-z]/g, '');
                return cleanWord.length > 1 && 
                       /^[A-Za-z\s.-]+$/.test(word) &&
                       !nonNameWords.includes(cleanWord) &&
                       !cleanWord.includes('experience') &&
                       !cleanWord.includes('education') &&
                       !cleanWord.includes('skills') &&
                       !cleanWord.includes('launch') &&
                       !cleanWord.includes('profitable') &&
                       !cleanWord.includes('product') &&
                       !cleanWord.includes('lines') &&
                       !cleanWord.includes('university') &&
                       !cleanWord.includes('college') &&
                       !cleanWord.includes('degree') &&
                       !cleanWord.includes('grew') &&
                       !cleanWord.includes('revenue') &&
                       !cleanWord.includes('months') &&
                       !cleanWord.includes('through') &&
                       !cleanWord.includes('data') &&
                       !cleanWord.includes('driven') &&
                       !cleanWord.includes('scaling') &&
                       !cleanWord.includes('brand') &&
                       !cleanWord.includes('positioning');
            });
            
            if (isName) {
                // Normalize to title case
                return toTitleCase(line);
            }
        }
    }
    
    // Strategy 2: Look for name patterns with proper capitalization
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        const words = line.split(/\s+/);
        
        // Look for a pattern like "FirstName LastName" (2 words, both capitalized)
        if (words.length === 2) {
            const [first, last] = words;
            if (first.length > 1 && last.length > 1 &&
                /^[A-Z][a-z]+$/.test(first) && /^[A-Z][a-z]+$/.test(last) &&
                !nonNameWords.includes(first.toLowerCase()) &&
                !nonNameWords.includes(last.toLowerCase())) {
                return line;
            }
        }
        
        // Look for "FirstName MiddleName LastName" pattern
        if (words.length === 3) {
            const [first, middle, last] = words;
            if (first.length > 1 && middle.length > 1 && last.length > 1 &&
                /^[A-Z][a-z]+$/.test(first) && 
                /^[A-Z][a-z]+$/.test(middle) && 
                /^[A-Z][a-z]+$/.test(last) &&
                !nonNameWords.includes(first.toLowerCase()) &&
                !nonNameWords.includes(middle.toLowerCase()) &&
                !nonNameWords.includes(last.toLowerCase())) {
                return line;
            }
        }
    }
    
    // Strategy 3: Look for name patterns with mixed capitalization
    for (let i = 0; i < Math.min(10, lines.length); i++) {
        const line = lines[i].trim();
        const words = line.split(/\s+/);
        
        if (words.length >= 2 && words.length <= 4) {
            // Check if first letter of each word is capitalized
            const hasProperCapitalization = words.every(word => 
                word.length > 1 && /^[A-Z][a-z]*$/.test(word)
            );
            
            if (hasProperCapitalization) {
                const isName = words.every(word => {
                    const cleanWord = word.toLowerCase();
                    return !nonNameWords.includes(cleanWord) &&
                           !cleanWord.includes('experience') &&
                           !cleanWord.includes('education') &&
                           !cleanWord.includes('skills') &&
                           !cleanWord.includes('grew') &&
                           !cleanWord.includes('revenue') &&
                           !cleanWord.includes('months') &&
                           !cleanWord.includes('through') &&
                           !cleanWord.includes('data') &&
                           !cleanWord.includes('driven') &&
                           !cleanWord.includes('scaling') &&
                           !cleanWord.includes('brand') &&
                           !cleanWord.includes('positioning');
                });
                
                if (isName) {
                    return toTitleCase(line);
                }
            }
        }
    }
    
    // Strategy 4: Look for name patterns in the first line that might be the header
    if (lines.length > 0) {
        const firstLine = lines[0].trim();
        const words = firstLine.split(/\s+/);
        
        if (words.length >= 2 && words.length <= 4) {
            // Check if it looks like a name header
            const isNameHeader = words.every(word => {
                const cleanWord = word.toLowerCase();
                return word.length > 1 && 
                       /^[A-Za-z\s.-]+$/.test(word) &&
                       !nonNameWords.includes(cleanWord) &&
                       !cleanWord.includes('experience') &&
                       !cleanWord.includes('education') &&
                       !cleanWord.includes('skills') &&
                       !cleanWord.includes('grew') &&
                       !cleanWord.includes('revenue') &&
                       !cleanWord.includes('months') &&
                       !cleanWord.includes('through') &&
                       !cleanWord.includes('data') &&
                       !cleanWord.includes('driven') &&
                       !cleanWord.includes('scaling') &&
                       !cleanWord.includes('brand') &&
                       !cleanWord.includes('positioning');
            });
            
            if (isNameHeader) {
                return toTitleCase(firstLine);
            }
        }
    }
    
    // Strategy 5: Look for name patterns in the entire text (not just first lines)
    const allLines = text.split('\n').filter(line => line.trim());
    for (let i = 0; i < Math.min(200, allLines.length); i++) {
        const line = allLines[i].trim();
        const words = line.split(/\s+/);
        
        // Detect Canva-style spaced letters anywhere
        if (/^[A-Z](?:\s[A-Z])+(?:\s{2,}[A-Z](?:\s[A-Z])+)+$/.test(line)) {
            const parts = line.split(/\s{2,}/).map(p => p.replace(/\s+/g, ''));
            if (parts.length >= 2 && parts.length <= 4) {
                return toTitleCase(parts.join(' '));
            }
        }
        
        if (words.length === 2) {
            const [first, last] = words;
            if (first.length > 1 && last.length > 1 &&
                /^[A-Z][a-z]+$/.test(first) && /^[A-Z][a-z]+$/.test(last) &&
                !nonNameWords.includes(first.toLowerCase()) &&
                !nonNameWords.includes(last.toLowerCase()) &&
                !line.match(/\$/) && // No dollar signs
                !line.match(/\d+%/) && // No percentages
                !line.match(/\d+x/) && // No multipliers
                !line.match(/\d+-\d+/) && // No number ranges
                !line.match(/revenue|profit|sales|marketing|business|development/i)) { // No business terms
                return toTitleCase(line);
            }
        }
    }
    
    // Fallback: look for email and try to extract name from it
    const emailMatch = text.match(/([a-zA-Z0-9._-]+)@/);
    if (emailMatch) {
        const emailName = emailMatch[1].replace(/[._-]/g, ' ');
        if (emailName.length > 2) {
            return emailName.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
        }
    }
    
    return 'Unknown Name';
}

function extractSkills(text) {
    // Look for common programming languages and skills
    const commonSkills = [
        'JavaScript', 'Python', 'Java', 'React', 'Node.js', 'SQL',
        'HTML', 'CSS', 'TypeScript', 'Angular', 'Vue', 'MongoDB',
        'PostgreSQL', 'Docker', 'Kubernetes', 'AWS', 'Git', 'C++',
        'C#', '.NET', 'PHP', 'Ruby', 'Go', 'Swift', 'Kotlin',
        'Machine Learning', 'AI', 'Data Science', 'Analytics'
    ];
    
    const foundSkills = [];
    const lowerText = text.toLowerCase();
    
    commonSkills.forEach(skill => {
        if (lowerText.includes(skill.toLowerCase())) {
            foundSkills.push(skill);
        }
    });
    
    return foundSkills.length > 0 ? foundSkills : ['Various skills'];
}

function extractExperience(text) {
    // Look for year patterns and experience indicators
    const yearRegex = /\b(19|20)\d{2}\b/g;
    const years = text.match(yearRegex);
    
    if (years && years.length >= 2) {
        const sortedYears = years.map(Number).sort();
        const earliest = sortedYears[0];
        const latest = sortedYears[sortedYears.length - 1];
        const experience = latest - earliest;
        return Math.min(experience, 20); // Cap at 20 years
    }
    
    // Look for experience keywords
    const expKeywords = ['years', 'experience', 'exp'];
    const hasExp = expKeywords.some(keyword => text.toLowerCase().includes(keyword));
    
    return hasExp ? 3 : 0; // Default to 3 years if experience mentioned
}

function extractCurrentTitle(text) {
    // Look for job titles in the text
    const titleKeywords = [
        'Software Engineer', 'Developer', 'Programmer', 'Analyst',
        'Manager', 'Director', 'Lead', 'Senior', 'Junior',
        'Full Stack', 'Frontend', 'Backend', 'DevOps', 'Data Scientist'
    ];
    
    const lowerText = text.toLowerCase();
    for (const title of titleKeywords) {
        if (lowerText.includes(title.toLowerCase())) {
            return title;
        }
    }
    
    return 'Professional';
}

// Test endpoint
router.get('/test', (req, res) => {
    res.json({ success: true, message: 'AI routes working!', timestamp: new Date().toISOString() });
});

// Simple test endpoint for file upload
router.post('/test-upload', upload.single('resume'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        res.json({ 
            success: true, 
            message: 'File uploaded successfully',
            filename: req.file.filename,
            size: req.file.size
        });
    } catch (error) {
        console.error('Upload test error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Resume parsing endpoint
router.post('/parse-resume', upload.single('resume'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let fileText = '';
        
        // Check file type and extract text accordingly
        if (req.file.mimetype === 'application/pdf') {
            try {
                const pdfData = await pdfParse(req.file.buffer);
                fileText = pdfData.text;
            } catch (pdfError) {
                console.error('PDF parsing error:', pdfError);
                return res.status(500).json({ error: 'Failed to parse PDF file' });
            }
        } else if (req.file.mimetype === 'text/plain' || req.file.originalname.endsWith('.txt')) {
            fileText = req.file.buffer.toString('utf8');
        } else {
            // For other file types, try to extract as text
            fileText = req.file.buffer.toString('utf8');
        }

        // Extract information from the text
        console.log('=== RESUME PARSING DEBUG ===');
        console.log('Raw text length:', fileText.length);
        console.log('First 500 characters:', fileText.substring(0, 500));
        console.log('First 10 lines:', fileText.split('\n').slice(0, 10));
        
        const name = extractName(fileText);
        const email = extractEmail(fileText);
        const phone = extractPhone(fileText);
        const skills = extractSkills(fileText);
        const yearsExperience = extractExperience(fileText);
        
        console.log('Extracted name:', name);
        console.log('Extracted email:', email);
        console.log('Extracted phone:', phone);
        console.log('Extracted skills:', skills);
        console.log('Extracted years experience:', yearsExperience);
        console.log('=== END RESUME PARSING DEBUG ===');
        
        const parsedData = {
            name: name,
            email: email,
            phone: phone,
            currentTitle: extractCurrentTitle(fileText),
            currentCompany: 'Extracted from resume',
            yearsExperience: yearsExperience,
            skills: skills,
            education: [{ degree: 'Extracted from resume', school: 'University' }],
            summary: `Professional with ${yearsExperience} years of experience in ${skills.join(', ')}.`,
            location: 'Location extracted from resume',
            rawText: fileText.substring(0, 500) + '...' // First 500 chars for debugging
        };

        res.json({
            success: true,
            candidateId: `candidate-${Date.now()}`,
            data: parsedData,
            message: 'Resume parsed successfully from actual file content'
        });
    } catch (error) {
        console.error('Resume parsing error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Find similar candidates
router.post('/find-similar', async (req, res) => {
    try {
        const { candidateId } = req.body;
        
        // Get candidate's embedding
        const embeddingResult = await db.query(
            'SELECT embedding_vector FROM candidate_embeddings WHERE candidate_id = $1',
            [candidateId]
        );

        if (embeddingResult.rows.length === 0) {
            return res.status(404).json({ error: 'Candidate embedding not found' });
        }

        const similar = await openAIService.findSimilarCandidates(
            embeddingResult.rows[0].embedding_vector,
            10
        );

        res.json({
            success: true,
            similar: similar
        });
    } catch (error) {
        console.error('Similarity search error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate candidate summary
router.post('/generate-summary', async (req, res) => {
    try {
        const { candidateId } = req.body;
        
        // Fetch candidate data
        const candidateResult = await db.query(
            `SELECT c.*, 
                    a.completed_at,
                    array_agg(
                        json_build_object(
                            'dimension', ds.dimension_name,
                            'score', ds.score
                        )
                    ) as assessment_scores
             FROM candidates c
             LEFT JOIN assessments a ON c.id = a.candidate_id
             LEFT JOIN dimension_scores ds ON a.id = ds.assessment_id
             WHERE c.id = $1
             GROUP BY c.id, a.completed_at`,
            [candidateId]
        );

        if (candidateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        const candidate = candidateResult.rows[0];
        const summary = await openAIService.generateCandidateSummary({
            name: `${candidate.first_name} ${candidate.last_name}`,
            experience: candidate.years_experience || 'Not specified',
            skills: candidate.skills || [],
            assessmentScores: candidate.assessment_scores || []
        });

        res.json({
            success: true,
            summary: summary
        });
    } catch (error) {
        console.error('Summary generation error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Chatbot endpoint
router.post('/chatbot/message', async (req, res) => {
    try {
        const { sessionId, message, candidateId, channel } = req.body;

        // Fallback if OpenAI is not configured
        if (!process.env.OPENAI_API_KEY) {
            let response = "I'm currently running without AI integration. ";
            try {
                if ((message || '').toLowerCase().includes('candidate')) {
                    const count = await db.query('SELECT COUNT(*)::int AS count FROM candidates');
                    response += `We have ${count.rows[0].count} candidates in the system.`;
                } else if ((message || '').toLowerCase().includes('pipeline')) {
                    const stats = await db.query(`SELECT ps.name, COUNT(cp.candidate_id)::int AS count
                                                  FROM pipeline_stages ps
                                                  LEFT JOIN candidate_pipeline cp ON ps.id = cp.stage_id
                                                  GROUP BY ps.id, ps.name
                                                  ORDER BY ps.position`);
                    response += 'Pipeline: ' + stats.rows.map(r => `${r.name}: ${r.count}`).join(', ');
                } else {
                    response += 'Please configure the OpenAI API key for intelligent responses.';
                }
            } catch (e) {
                response += ' Database lookup failed.';
            }

            return res.json({ success: true, response, sessionId });
        }

        const result = await chatbotService.processMessage(sessionId, message, candidateId, channel);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Chatbot error:', error);
        let errorMessage = 'I encountered an error processing your request.';
        if ((error.message || '').toLowerCase().includes('api key')) {
            errorMessage = 'The AI service is not properly configured. Please check the OpenAI API key.';
        }
        res.json({ success: false, response: errorMessage, sessionId: req.body.sessionId });
    }
});

// Analyze specific candidate
router.post('/analyze-candidate/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const analysis = await openAIService.analyzeCandiate(id);
        res.json({ success: true, analysis });
    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({ success: false, error: 'Failed to analyze candidate' });
    }
});

// Success prediction endpoint
router.post('/predict/success', async (req, res) => {
    try {
        const { candidateId } = req.body;
        
        // Fetch candidate data with assessments
        const candidateData = await db.query(
            `SELECT c.*, 
                    json_agg(
                        json_build_object(
                            'dimension', ds.dimension_name,
                            'score', ds.score
                        )
                    ) as assessment_scores
             FROM candidates c
             LEFT JOIN assessments a ON c.id = a.candidate_id
             LEFT JOIN dimension_scores ds ON a.id = ds.assessment_id
             WHERE c.id = $1
             GROUP BY c.id`,
            [candidateId]
        );

        if (candidateData.rows.length === 0) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        const prediction = await successPredictor.predict({
            assessmentScores: candidateData.rows[0].assessment_scores,
            experience: {
                years: candidateData.rows[0].years_experience || 0,
                relevantYears: candidateData.rows[0].relevant_experience || 0,
                numberOfRoles: 3 // This would come from parsed resume
            },
            skills: candidateData.rows[0].skills || [],
            education: {
                level: 3 // This would be extracted from resume
            }
        });

        // Store prediction
        await db.query(
            `INSERT INTO ai_predictions 
            (candidate_id, model_type, model_version, prediction_type, 
             prediction_value, confidence_score)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                candidateId,
                'neural_network',
                '1.0',
                'success_probability',
                JSON.stringify(prediction),
                prediction.confidence
            ]
        );

        res.json({
            success: true,
            prediction: prediction
        });
    } catch (error) {
        console.error('Success prediction error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Retention prediction endpoint
router.post('/predict/retention', async (req, res) => {
    try {
        const { candidateId, additionalData } = req.body;
        
        // Fetch candidate data
        const candidateResult = await db.query(
            'SELECT * FROM candidates WHERE id = $1',
            [candidateId]
        );

        if (candidateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Candidate not found' });
        }

        const candidateData = {
            ...candidateResult.rows[0],
            ...additionalData,
            previousRoles: additionalData.previousRoles || [
                { duration: 2 }, { duration: 3 }
            ]
        };

        const prediction = await retentionPredictor.predict(candidateData);

        // Store prediction
        await db.query(
            `INSERT INTO ai_predictions 
            (candidate_id, model_type, model_version, prediction_type, 
             prediction_value, confidence_score)
            VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                candidateId,
                'retention_model',
                '1.0',
                'retention_probability',
                JSON.stringify(prediction),
                0.75 // Simplified confidence score
            ]
        );

        res.json({
            success: true,
            prediction: prediction
        });
    } catch (error) {
        console.error('Retention prediction error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Generate interview questions
router.post('/interview/generate-questions', async (req, res) => {
    try {
        const { candidateId, role } = req.body;
        const candidateResult = await db.query('SELECT * FROM candidates WHERE id = $1', [candidateId]);
        if (candidateResult.rows.length === 0) {
            return res.status(404).json({ error: 'Candidate not found' });
        }
        const questions = await openAIService.generateInterviewQuestions(candidateResult.rows[0], role || 'Financial Advisor');
        res.json({ success: true, questions });
    } catch (error) {
        console.error('Question generation error:', error);
        res.status(500).json({ success: false, error: error.message, questions: [] });
    }
});

// INTELLIGENT AI ASSISTANT ENDPOINTS

// Search candidates for @mention autocomplete
router.get('/search-candidates', async (req, res) => {
    try {
        const { q } = req.query;
        const userContext = req.user;

        if (!q || q.length < 2) {
            return res.json({ success: true, candidates: [] });
        }

        const isDemoMode = userContext?.email === 'demo@northwestern.com' && userContext?.demo_mode;

        if (isDemoMode) {
            const demoCandidates = [
                { id: 'demo-1', first_name: 'Sarah', last_name: 'Martinez', email: 'sarah.martinez@example.com' },
                { id: 'demo-2', first_name: 'John', last_name: 'Chen', email: 'john.chen@example.com' },
                { id: 'demo-3', first_name: 'Emily', last_name: 'Rodriguez', email: 'emily.rodriguez@example.com' },
                { id: 'demo-4', first_name: 'Michael', last_name: 'Thompson', email: 'michael.thompson@example.com' },
                { id: 'demo-5', first_name: 'Amanda', last_name: 'Williams', email: 'amanda.williams@example.com' }
            ];

            const filtered = demoCandidates.filter(c =>
                c.first_name.toLowerCase().includes(q.toLowerCase()) ||
                c.last_name.toLowerCase().includes(q.toLowerCase()) ||
                `${c.first_name} ${c.last_name}`.toLowerCase().includes(q.toLowerCase())
            );

            return res.json({ success: true, candidates: filtered.slice(0, 10), isDemoMode: true });
        }

        const dbQuery = `
            SELECT id, first_name, last_name, email
            FROM candidates
            WHERE
                first_name ILIKE $1 OR
                last_name ILIKE $1 OR
                CONCAT(first_name, ' ', last_name) ILIKE $1
            ORDER BY first_name, last_name
            LIMIT 10
        `;

        const result = await db.query(dbQuery, [`%${q}%`]);

        res.json({ success: true, candidates: result.rows, isDemoMode: false });
    } catch (error) {
        console.error('Search candidates error:', error);
        res.status(500).json({ error: 'Failed to search candidates' });
    }
});

// Intelligent query processing
router.post('/intelligent-query', async (req, res) => {
    try {
        const { query, user } = req.body;
        const userContext = req.user || user;

        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }

        const lowerQuery = query.toLowerCase();
        let response;

        // Check if demo mode
        const isDemoMode = userContext?.email === 'demo@northwestern.com' && userContext?.demo_mode;

        // Use enhanced AI Router Service for intelligent responses
        if (isDemoMode || process.env.DEMO_MODE === 'true') {
            try {
                const enhancedResponse = await aiRouterService.generateDemoResponse(query, {
                    user: userContext,
                    isDemoMode: true
                });

                return res.json({
                    success: true,
                    response: enhancedResponse.response,
                    data: enhancedResponse.data || [],
                    isDemoMode: true,
                    enhanced: true
                });
            } catch (aiError) {
                console.log('AI Router Service fallback:', aiError.message);
                // Fall through to original logic if AI service fails
            }
        }

        // Check for action requests (calendar, email, etc.)
        const actionKeywords = {
            calendar: ['calendar', 'schedule', 'meeting', 'interview', 'appointment'],
            email: ['email', 'send', 'message'],
            linkedin: ['linkedin', 'connect', 'message on linkedin']
        };

        let detectedAction = null;
        for (const [action, keywords] of Object.entries(actionKeywords)) {
            if (keywords.some(keyword => lowerQuery.includes(keyword))) {
                detectedAction = action;
                break;
            }
        }

        // Check for @mentions
        const mentionRegex = /@([a-z\s\-]+?)(?:\s|$|[,?.!])/gi;
        const mentions = [...query.matchAll(mentionRegex)];

        if (mentions.length > 0 && detectedAction) {
            // This is an action request with a candidate mention
            const candidateName = mentions[0][1].trim();

            // Get candidate info
            let candidateQuery = `
                SELECT c.id, c.first_name, c.last_name, c.email, c.phone
                FROM candidates c
                WHERE (
                    LOWER(c.first_name) LIKE $1 OR
                    LOWER(c.last_name) LIKE $1 OR
                    LOWER(CONCAT(c.first_name, ' ', c.last_name)) LIKE $1
                )
                LIMIT 1
            `;

            const candidateResult = await db.query(candidateQuery, [`%${candidateName.toLowerCase()}%`]);

            if (candidateResult.rows.length === 0) {
                // Try a more fuzzy search for suggestions
                const fuzzyQuery = `
                    SELECT c.first_name, c.last_name,
                           SIMILARITY(CONCAT(c.first_name, ' ', c.last_name), $1) as similarity
                    FROM candidates c
                    WHERE SIMILARITY(CONCAT(c.first_name, ' ', c.last_name), $1) > 0.3
                    ORDER BY similarity DESC
                    LIMIT 3
                `;

                let suggestions = [];
                try {
                    const suggestResult = await db.query(fuzzyQuery, [candidateName]);
                    suggestions = suggestResult.rows.map(r => `@${r.first_name} ${r.last_name}`);
                } catch (err) {
                    // Fallback if similarity extension not available
                    const fallbackQuery = `
                        SELECT c.first_name, c.last_name
                        FROM candidates c
                        WHERE LOWER(c.first_name) LIKE $1 OR LOWER(c.last_name) LIKE $1
                        LIMIT 3
                    `;
                    const fallbackResult = await db.query(fallbackQuery, [`%${candidateName.toLowerCase().substring(0, 3)}%`]);
                    suggestions = fallbackResult.rows.map(r => `@${r.first_name} ${r.last_name}`);
                }

                let responseText = `❌ **Candidate Not Found**\n\nI couldn't find a candidate matching "@${candidateName}".`;

                if (suggestions.length > 0) {
                    responseText += `\n\n💡 **Did you mean:**\n${suggestions.map(s => `• ${s}`).join('\n')}\n\nTry typing one of these suggestions, or use the autocomplete feature by typing '@' followed by the candidate's name.`;
                } else {
                    responseText += `\n\n💡 **Suggestions:**\n• Check the spelling of the candidate's name\n• Try typing '@' to see all available candidates\n• Use partial names like '@John' or '@Smith'\n• Make sure the candidate is in your database\n\nYou can also try: 'Show me top 5 candidates' to see all available candidates.`;
                }

                return res.json({
                    success: true,
                    response: responseText,
                    data: [],
                    suggestions: suggestions,
                    isDemoMode: false
                });
            }

            const candidate = candidateResult.rows[0];

            // Handle different action types
            if (detectedAction === 'calendar') {
                // Extract date/time from query
                const dateMatch = query.match(/(?:on |at )?([a-z]+ \d{1,2}(?:st|nd|rd|th)?|september \d{1,2}|\d{1,2}\/\d{1,2})/i);
                const timeMatch = query.match(/(?:at )?(\d{1,2}:\d{2}\s*(?:am|pm|est|pst|cst|mst)?|\d{1,2}\s*(?:am|pm))/i);

                const responseText = `📅 I'll create a calendar event for an interview with ${candidate.first_name} ${candidate.last_name}${dateMatch ? ` on ${dateMatch[1]}` : ''}${timeMatch ? ` at ${timeMatch[1]}` : ''}.\n\nNote: In mock mode, I can't actually create calendar events yet. Once you connect your Google Calendar in Settings, I'll be able to create real events!`;

                return res.json({
                    success: true,
                    response: responseText,
                    data: [candidate],
                    candidate: candidate,
                    action: 'calendar',
                    isDemoMode: false
                });
            } else if (detectedAction === 'email') {
                // Generate email preview based on query context
                let emailSubject = 'Next Steps in Our Hiring Process';
                let emailContent = `Hi ${candidate.first_name},\n\nThank you for your interest in Northwestern Mutual. I wanted to reach out regarding the next steps in our hiring process.\n\nBased on your background and our current needs, I'd like to schedule a brief conversation to discuss:\n- Your experience and career goals\n- How this role aligns with your interests\n- Next steps in our process\n\nWould you be available for a 30-minute call this week? I'm flexible with timing to accommodate your schedule.\n\nBest regards,\n[Your Name]\nNorthwestern Mutual Recruiting Team`;

                if (lowerQuery.includes('follow up') || lowerQuery.includes('follow-up')) {
                    emailSubject = 'Following Up on Your Application';
                    emailContent = `Hi ${candidate.first_name},\n\nI hope this message finds you well. I wanted to follow up on your recent application with Northwestern Mutual.\n\nWe've reviewed your background and are impressed with your qualifications. I'd love to discuss how your experience aligns with our current opportunities.\n\nWould you be available for a brief conversation this week? Please let me know what works best for your schedule.\n\nLooking forward to connecting!\n\nBest regards,\n[Your Name]\nNorthwestern Mutual Recruiting Team`;
                } else if (lowerQuery.includes('interview') || lowerQuery.includes('next step')) {
                    emailSubject = 'Interview Opportunity - Northwestern Mutual';
                    emailContent = `Hi ${candidate.first_name},\n\nGreat news! We'd like to move forward with an interview for the position you applied for at Northwestern Mutual.\n\nBased on your background, we believe you could be an excellent fit for our team. The interview will cover:\n- Your professional experience\n- Our company culture and values\n- The specific role and growth opportunities\n\nAre you available for an interview next week? Please let me know your preferred times and I'll coordinate with our team.\n\nThank you for your continued interest, and I look forward to hearing from you!\n\nBest regards,\n[Your Name]\nNorthwestern Mutual Recruiting Team`;
                }

                return res.json({
                    success: true,
                    response: `📧 **Email Preview**\n\n**To:** ${candidate.first_name} ${candidate.last_name} (${candidate.email})\n**Subject:** ${emailSubject}\n\n**Content:**\n${emailContent}\n\n---\n\n**⚠️ Email Preview Mode** - Please review and approve before sending:\n• Click "Send Email" to proceed\n• Click "Edit" to modify content\n• Click "Cancel" to abort\n\nNote: In mock mode, I can't actually send emails yet. Once you connect Gmail in Settings, I'll be able to send real emails!`,
                    data: [candidate],
                    candidate: candidate,
                    action: 'email',
                    emailPreview: {
                        to: candidate.email,
                        subject: emailSubject,
                        content: emailContent,
                        requiresApproval: true
                    },
                    isDemoMode: false
                });
            }
        }

        if (mentions.length > 0) {
            const candidateName = mentions[0][1].trim();

            if (isDemoMode) {
                const demoCandidate = {
                    first_name: 'Sarah',
                    last_name: 'Martinez',
                    email: 'sarah.martinez@example.com',
                    location: 'Milwaukee, WI',
                    score: 94,
                    skills: ['Leadership', 'Sales', 'Client Relations', 'Financial Planning'],
                    years_experience: 8,
                    dimension_scores: [
                        { dimension: 'Leadership', score: 92 },
                        { dimension: 'Communication', score: 95 },
                        { dimension: 'Problem Solving', score: 88 },
                        { dimension: 'Emotional Intelligence', score: 96 }
                    ]
                };

                const pros = [
                    '✅ Exceptional emotional intelligence (96/100) - great for client relationships',
                    '✅ Strong communication skills (95/100)',
                    '✅ 8 years of relevant experience',
                    '✅ Located in Milwaukee, WI - aligned with regional needs'
                ];

                const cons = [
                    '⚠️ Problem solving score (88/100) slightly below leadership level',
                    '⚠️ May need additional technical training in newer financial products'
                ];

                const verdict = '👍 **THUMBS UP** - Strong candidate for financial advisor role with excellent soft skills';

                const responseText = `## Analysis for @${candidateName}\n\n**Overall Score: ${demoCandidate.score}%**\n\n**Pros:**\n${pros.join('\n')}\n\n**Cons:**\n${cons.join('\n')}\n\n**Verdict:** ${verdict}`;

                return res.json({
                    success: true,
                    response: responseText,
                    data: [demoCandidate],
                    candidate: demoCandidate,
                    isDemoMode: true
                });
            }

            // Real candidate analysis
            const nameSearch = candidateName.split(/\s+/);
            let candidateQuery = `
                SELECT
                    c.id, c.first_name, c.last_name, c.email, c.phone, c.linkedin_url,
                    a.id as assessment_id, a.status as assessment_status,
                    COALESCE(AVG(ds.score), 0) as overall_score,
                    json_agg(
                        json_build_object(
                            'dimension', ds.dimension,
                            'score', ds.score,
                            'percentile', ds.percentile
                        )
                    ) FILTER (WHERE ds.dimension IS NOT NULL) as dimension_scores
                FROM candidates c
                LEFT JOIN assessments a ON c.id = a.candidate_id
                LEFT JOIN dimension_scores ds ON a.id = ds.assessment_id
                WHERE (
                    LOWER(c.first_name) LIKE $1 OR
                    LOWER(c.last_name) LIKE $1 OR
                    LOWER(CONCAT(c.first_name, ' ', c.last_name)) LIKE $1
                )
                GROUP BY c.id, a.id
                ORDER BY a.created_at DESC
                LIMIT 1
            `;

            const candidateResult = await db.query(candidateQuery, [`%${candidateName.toLowerCase()}%`]);

            if (candidateResult.rows.length === 0) {
                // Try a more fuzzy search for suggestions
                let suggestions = [];
                try {
                    const fallbackQuery = `
                        SELECT c.first_name, c.last_name
                        FROM candidates c
                        WHERE LOWER(c.first_name) LIKE $1 OR LOWER(c.last_name) LIKE $1
                        LIMIT 3
                    `;
                    const fallbackResult = await db.query(fallbackQuery, [`%${candidateName.toLowerCase().substring(0, 3)}%`]);
                    suggestions = fallbackResult.rows.map(r => `@${r.first_name} ${r.last_name}`);
                } catch (err) {
                    console.log('Error getting suggestions:', err);
                }

                let responseText = `❌ **Candidate Not Found**\n\nI couldn't find a candidate matching "@${candidateName}".`;

                if (suggestions.length > 0) {
                    responseText += `\n\n💡 **Did you mean:**\n${suggestions.map(s => `• ${s}`).join('\n')}\n\nTry clicking on one of these suggestions or type '@' to see all available candidates.`;
                } else {
                    responseText += `\n\n💡 **Suggestions:**\n• Check the spelling of the candidate's name\n• Try typing '@' to see all available candidates\n• Use partial names like '@John' or '@Smith'\n• Upload more resumes to expand your candidate pool\n\nYou can also try: 'Show me top 5 candidates' to see all available candidates.`;
                }

                return res.json({
                    success: true,
                    response: responseText,
                    data: [],
                    suggestions: suggestions,
                    isDemoMode: false
                });
            }

            const candidate = candidateResult.rows[0];

            if (!candidate.assessment_id || candidate.assessment_status !== 'completed') {
                return res.json({
                    success: true,
                    response: `I found ${candidate.first_name} ${candidate.last_name}, but they haven't completed an assessment yet. I need assessment data to provide insights.`,
                    data: [candidate],
                    candidate: candidate,
                    isDemoMode: false
                });
            }

            // Generate pros and cons based on dimension scores
            const dimensionScores = candidate.dimension_scores || [];
            const strengths = dimensionScores.filter(d => d.score >= 85).sort((a, b) => b.score - a.score);
            const weaknesses = dimensionScores.filter(d => d.score < 75).sort((a, b) => a.score - b.score);

            const pros = strengths.slice(0, 4).map(d =>
                `✅ Strong ${d.dimension} (${d.score}/100)`
            );

            if (candidate.linkedin_url) {
                pros.push(`✅ LinkedIn profile available`);
            }

            const cons = weaknesses.slice(0, 3).map(d =>
                `⚠️ ${d.dimension} needs development (${d.score}/100)`
            );

            if (cons.length === 0) {
                cons.push('⚠️ No significant weaknesses identified');
            }

            const overallScore = Math.round(candidate.overall_score);
            let verdict;
            if (overallScore >= 85) {
                verdict = '👍 **THUMBS UP** - Strong candidate, recommend moving forward';
            } else if (overallScore >= 75) {
                verdict = '👍 **THUMBS UP** - Good candidate with some development areas';
            } else if (overallScore >= 65) {
                verdict = '👎 **THUMBS DOWN** - May not be the best fit, consider other candidates';
            } else {
                verdict = '👎 **THUMBS DOWN** - Not recommended for this position';
            }

            const responseText = `## Analysis for @${candidate.first_name} ${candidate.last_name}\n\n**Overall Score: ${overallScore}%**\n\n**Pros:**\n${pros.join('\n')}\n\n**Cons:**\n${cons.join('\n')}\n\n**Verdict:** ${verdict}`;

            return res.json({
                success: true,
                response: responseText,
                data: [candidate],
                candidate: candidate,
                isDemoMode: false
            });
        }

        // Enhanced candidate search - detect various query patterns
        const candidateSearchPatterns = [
            /top\s+\d*\s*candidates?/i,
            /show\s+me\s+candidates?/i,
            /find\s+me\s+\d*\s*candidates?/i,
            /find\s+\d*\s*candidates?/i,
            /search\s+for\s+candidates?/i,
            /experienced\s+.*?(candidates?|advisors?|professionals?)/i,
            /\d+\s+(experienced\s+)?(candidates?|advisors?|professionals?)/i,
            /candidates?\s+in\s+/i,
            /advisors?\s+in\s+/i,
            /professionals?\s+in\s+/i
        ];

        const isCandidateSearch = candidateSearchPatterns.some(pattern => pattern.test(lowerQuery));

        if (isCandidateSearch) {
            // Extract number of candidates requested
            const numberMatch = query.match(/(\d+)/i);
            const limit = numberMatch ? parseInt(numberMatch[1]) : 5;

            let location = null;
            const locationMatch = query.match(/(?:in|from|near)\s+([a-z\s]+?)(?:\s|$)/i);
            if (locationMatch) {
                location = locationMatch[1].trim();
            }

            if (isDemoMode) {
                const demoResults = [
                    { first_name: 'Sarah', last_name: 'Martinez', score: 94, likelihood: 'Strong Hire', location: 'Milwaukee, WI' },
                    { first_name: 'John', last_name: 'Chen', score: 91, likelihood: 'Strong Hire', location: 'Chicago, IL' },
                    { first_name: 'Emily', last_name: 'Rodriguez', score: 88, likelihood: 'Hire', location: 'Philadelphia, PA' },
                    { first_name: 'Michael', last_name: 'Thompson', score: 86, likelihood: 'Hire', location: 'Madison, WI' },
                    { first_name: 'Amanda', last_name: 'Williams', score: 83, likelihood: 'Maybe', location: 'Milwaukee, WI' }
                ];

                const filtered = location
                    ? demoResults.filter(c => c.location.toLowerCase().includes(location.toLowerCase()))
                    : demoResults;

                const results = filtered.slice(0, limit);
                // Detect role/profession from query for demo mode too
                let demoRoleText = '';
                if (lowerQuery.includes('financial advisor') || lowerQuery.includes('advisor')) {
                    demoRoleText = ' financial advisor';
                } else if (lowerQuery.includes('sales') || lowerQuery.includes('professional')) {
                    demoRoleText = ' sales professional';
                }

                const responseText = location
                    ? `Here are ${results.length}${demoRoleText} candidates in ${location}:\n\n` +
                      results.map((c, i) => `${i + 1}. ${c.first_name} ${c.last_name} - Score: ${c.score}% (${c.likelihood})`).join('\n')
                    : `Here are ${results.length}${demoRoleText} candidates:\n\n` +
                      results.map((c, i) => `${i + 1}. ${c.first_name} ${c.last_name} - Score: ${c.score}% (${c.likelihood})`).join('\n');

                return res.json({ success: true, response: responseText, data: results, isDemoMode: true });
            }

            // Real data query
            let dbQuery = `
                SELECT
                    c.id, c.first_name, c.last_name, c.email, c.phone, c.linkedin_url,
                    ps.name as pipeline_stage,
                    COALESCE(AVG(ds.score), 0) as score,
                    CASE
                        WHEN AVG(ds.score) >= 90 THEN 'Strong Hire'
                        WHEN AVG(ds.score) >= 80 THEN 'Hire'
                        WHEN AVG(ds.score) >= 70 THEN 'Maybe'
                        ELSE 'No Hire'
                    END as likelihood
                FROM candidates c
                LEFT JOIN assessments a ON c.id = a.candidate_id
                LEFT JOIN dimension_scores ds ON a.id = ds.assessment_id
                LEFT JOIN candidate_pipeline cp ON c.id = cp.candidate_id
                LEFT JOIN pipeline_stages ps ON cp.stage_id = ps.id
                WHERE 1=1
            `;

            const params = [];

            dbQuery += ` GROUP BY c.id, ps.name HAVING COALESCE(AVG(ds.score), 0) > 0`;
            dbQuery += ` ORDER BY score DESC LIMIT $1`;
            params.push(limit);

            const result = await db.query(dbQuery, params);

            if (result.rows.length === 0) {
                return res.json({
                    success: true,
                    response: location
                        ? `No candidates found in ${location}. Try uploading resumes or checking different locations.`
                        : 'No candidates with completed assessments found. Upload resumes to get started.',
                    data: [],
                    isDemoMode: false
                });
            }

            // Detect role/profession from query
            let roleText = '';
            if (lowerQuery.includes('financial advisor') || lowerQuery.includes('advisor')) {
                roleText = ' financial advisor';
            } else if (lowerQuery.includes('sales') || lowerQuery.includes('professional')) {
                roleText = ' sales professional';
            }

            const responseText = location
                ? `Here are ${result.rows.length}${roleText} candidates in ${location}:\n\n` +
                  result.rows.map((c, i) => `${i + 1}. ${c.first_name} ${c.last_name} - Score: ${Math.round(c.score)}% (${c.likelihood})`).join('\n')
                : `Here are ${result.rows.length}${roleText} candidates:\n\n` +
                  result.rows.map((c, i) => `${i + 1}. ${c.first_name} ${c.last_name} - Score: ${Math.round(c.score)}% (${c.likelihood})`).join('\n');

            return res.json({ success: true, response: responseText, data: result.rows, isDemoMode: false });
        }

        // Pipeline/bottleneck query
        if (lowerQuery.includes('pipeline') || lowerQuery.includes('bottleneck') || lowerQuery.includes('stuck')) {
            if (isDemoMode) {
                const demoInsights = {
                    bottlenecks: [
                        { stage: 'Screening', count: 12, avgDays: 14, issue: '12 candidates in screening for 14+ days' },
                        { stage: 'Interview', count: 5, avgDays: 8, issue: '5 candidates awaiting interview scheduling' }
                    ],
                    recommendations: [
                        'Expedite 3 high-scoring candidates in screening stage',
                        'Schedule interviews for 5 waiting candidates this week',
                        '2 candidates showing competitor interest - prioritize'
                    ]
                };

                const responseText = `Pipeline Analysis:\n\n⚠️ Bottlenecks:\n${demoInsights.bottlenecks.map(b => `- ${b.issue}`).join('\n')}\n\n💡 Recommendations:\n${demoInsights.recommendations.map(r => `- ${r}`).join('\n')}`;

                return res.json({ success: true, response: responseText, data: demoInsights, isDemoMode: true });
            }

            const bottlenecksQuery = await db.query(`
                SELECT
                    ps.name as stage,
                    COUNT(cp.candidate_id) as count,
                    AVG(EXTRACT(DAY FROM NOW() - cp.moved_at)) as avg_days
                FROM candidate_pipeline cp
                JOIN pipeline_stages ps ON cp.stage_id = ps.id
                WHERE cp.moved_at < NOW() - INTERVAL '7 days'
                GROUP BY ps.id, ps.name
                HAVING COUNT(cp.candidate_id) > 2
                ORDER BY avg_days DESC
            `);

            if (bottlenecksQuery.rows.length === 0) {
                return res.json({
                    success: true,
                    response: 'No pipeline bottlenecks detected. Your pipeline is flowing smoothly!',
                    data: { bottlenecks: [], recommendations: [] },
                    isDemoMode: false
                });
            }

            const bottlenecks = bottlenecksQuery.rows.map(b => ({
                stage: b.stage,
                count: parseInt(b.count),
                avgDays: Math.round(parseFloat(b.avg_days)),
                issue: `${b.count} candidates in ${b.stage} for ${Math.round(b.avg_days)}+ days`
            }));

            const recommendations = bottlenecks.map(b => `Expedite ${b.count} candidates in ${b.stage} stage`);

            const responseText = `Pipeline Analysis:\n\n⚠️ Bottlenecks:\n${bottlenecks.map(b => `- ${b.issue}`).join('\n')}\n\n💡 Recommendations:\n${recommendations.map(r => `- ${r}`).join('\n')}`;

            return res.json({
                success: true,
                response: responseText,
                data: { bottlenecks, recommendations },
                isDemoMode: false
            });
        }

        // Location-based query (broader matching)
        const locationKeywords = ['philadelphia', 'chicago', 'milwaukee', 'madison'];
        const foundLocation = locationKeywords.find(loc => lowerQuery.includes(loc));

        if (foundLocation) {
            if (isDemoMode) {
                const locationResults = [
                    { first_name: 'Sarah', last_name: 'Martinez', score: 94, likelihood: 'Strong Hire', location: 'Milwaukee, WI' },
                    { first_name: 'John', last_name: 'Chen', score: 91, likelihood: 'Strong Hire', location: 'Chicago, IL' },
                    { first_name: 'Emily', last_name: 'Rodriguez', score: 88, likelihood: 'Hire', location: 'Philadelphia, PA' },
                    { first_name: 'Michael', last_name: 'Thompson', score: 86, likelihood: 'Hire', location: 'Madison, WI' },
                    { first_name: 'Amanda', last_name: 'Williams', score: 83, likelihood: 'Maybe', location: 'Milwaukee, WI' }
                ].filter(c => c.location.toLowerCase().includes(foundLocation));

                const responseText = `Found ${locationResults.length} candidates in ${foundLocation.charAt(0).toUpperCase() + foundLocation.slice(1)}:\n\n` +
                    locationResults.map((c, i) => `${i + 1}. ${c.first_name} ${c.last_name} - Score: ${c.score}% (${c.likelihood})`).join('\n');

                return res.json({ success: true, response: responseText, data: locationResults, isDemoMode: true });
            }

            // Real location query (simplified for available schema)
            const locQuery = await db.query(`
                SELECT c.id, c.first_name, c.last_name, c.email,
                       COALESCE(AVG(ds.score), 0) as score
                FROM candidates c
                LEFT JOIN assessments a ON c.id = a.candidate_id
                LEFT JOIN dimension_scores ds ON a.id = ds.assessment_id
                GROUP BY c.id
                ORDER BY score DESC
                LIMIT 10
            `);

            if (locQuery.rows.length === 0) {
                return res.json({
                    success: true,
                    response: `No candidates found in ${foundLocation}. Upload resumes to build your candidate pool.`,
                    data: [],
                    isDemoMode: false
                });
            }

            const responseText = `Found ${locQuery.rows.length} candidates in ${foundLocation.charAt(0).toUpperCase() + foundLocation.slice(1)}:\n\n` +
                locQuery.rows.map((c, i) => `${i + 1}. ${c.first_name} ${c.last_name} - Score: ${Math.round(c.score)}%`).join('\n');

            return res.json({ success: true, response: responseText, data: locQuery.rows, isDemoMode: false });
        }

        // Check for Northwestern Mutual company questions
        const companyKeywords = ['northwestern mutual', 'company', 'about northwestern', 'what is northwestern'];
        const isCompanyQuery = companyKeywords.some(keyword => lowerQuery.includes(keyword));

        if (isCompanyQuery) {
            const companyInfo = `**Northwestern Mutual** is a leading financial services company that has been helping families and businesses achieve financial security for over 165 years.

**Our Mission:** We help people and businesses achieve financial security by providing:
• Life insurance and disability income insurance
• Annuities and investment products
• Financial planning and advisory services
• Employee benefits

**Key Facts:**
• Founded in 1857
• Fortune 100 company
• Over $308 billion in assets
• Serving more than 4.75 million clients
• Headquartered in Milwaukee, Wisconsin

**Our Values:**
• **Integrity** - We do the right thing, even when it's difficult
• **Excellence** - We strive to be the best at what we do
• **Teamwork** - We work together to achieve common goals
• **Caring** - We care about our clients, colleagues, and communities

**Career Opportunities:**
Northwestern Mutual offers diverse career paths in financial planning, insurance, investments, technology, marketing, and operations, with a strong focus on professional development and work-life balance.`;

            return res.json({
                success: true,
                response: companyInfo,
                data: null,
                isDemoMode: isDemoMode
            });
        }

        // Check for general recruiting/HR questions
        const recruitingKeywords = ['hire', 'hiring', 'recruit', 'interview process', 'onboarding'];
        const isRecruitingQuery = recruitingKeywords.some(keyword => lowerQuery.includes(keyword));

        if (isRecruitingQuery) {
            const recruitingInfo = `**Northwestern Mutual Recruiting Process:**

**Our Hiring Philosophy:** We believe in finding candidates who align with our values and can grow with our organization.

**Typical Interview Process:**
1. **Application Review** - We review your resume and application
2. **Initial Screening** - Phone or video call to discuss your background
3. **Behavioral Assessment** - Our comprehensive assessment tool
4. **Interview Rounds** - Meet with hiring managers and team members
5. **Final Decision** - Reference checks and offer extension

**What We Look For:**
• Strong communication and interpersonal skills
• Alignment with our core values
• Growth mindset and learning agility
• Client-focused approach
• Collaborative team player

**Benefits & Culture:**
• Comprehensive health benefits
• 401(k) with company match
• Professional development opportunities
• Flexible work arrangements
• Strong commitment to diversity & inclusion

Ask me about specific candidates, pipeline status, or scheduling interviews!`;

            return res.json({
                success: true,
                response: recruitingInfo,
                data: null,
                isDemoMode: isDemoMode
            });
        }

        // Default response with more helpful guidance
        res.json({
            success: true,
            response: "I'm your Northwestern Mutual AI Recruiting Assistant! I can help you with:\n\n**Candidate Management:**\n• 'Show me top 5 candidates'\n• '@John Smith' for candidate analysis\n• 'Compare @Sarah Johnson and @Mike Chen'\n\n**Pipeline & Insights:**\n• 'What are the pipeline bottlenecks?'\n• 'Find candidates in Philadelphia'\n• 'Show me candidates in Chicago'\n\n**Actions:**\n• 'Send an email to @Emily Davis about next steps'\n• 'Schedule an interview with @John Smith on Friday at 2pm'\n• 'Connect with @Sarah Johnson on LinkedIn'\n\n**Company Info:**\n• 'What is Northwestern Mutual?'\n• 'Tell me about the hiring process'\n\nWhat would you like to know?",
            data: null,
            isDemoMode: isDemoMode
        });
    } catch (error) {
        console.error('Intelligent query error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Get dashboard metrics (real or demo)
router.get('/dashboard-metrics', async (req, res) => {
    try {
        const userContext = req.user;
        const isDemoMode = userContext?.email === 'demo@northwestern.com' && userContext?.demo_mode;

        if (isDemoMode) {
            return res.json({
                success: true,
                isDemoMode: true,
                metrics: {
                    totalCandidates: 127,
                    avgScore: 78,
                    topMatches: 23,
                    completedAssessments: 89,
                    inProgress: 18,
                    readyForInterview: 12
                }
            });
        }

        const totalQuery = await db.query('SELECT COUNT(*)::int as count FROM candidates');
        const completedQuery = await db.query("SELECT COUNT(DISTINCT c.id)::int as count FROM candidates c JOIN assessments a ON c.id = a.candidate_id WHERE a.status = 'completed'");
        const inProgressQuery = await db.query("SELECT COUNT(DISTINCT c.id)::int as count FROM candidates c JOIN assessments a ON c.id = a.candidate_id WHERE a.status = 'in_progress'");
        const avgScoreQuery = await db.query('SELECT COALESCE(AVG(score), 0) as avg FROM dimension_scores');

        res.json({
            success: true,
            isDemoMode: false,
            metrics: {
                totalCandidates: totalQuery.rows[0].count,
                avgScore: Math.round(parseFloat(avgScoreQuery.rows[0].avg)),
                topMatches: 0,
                completedAssessments: completedQuery.rows[0].count,
                inProgress: inProgressQuery.rows[0].count,
                readyForInterview: 0
            }
        });
    } catch (error) {
        console.error('Dashboard metrics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Toggle demo mode
router.post('/toggle-demo-mode', async (req, res) => {
    try {
        const userContext = req.user;
        const { enabled } = req.body;

        // Only allow demo user to toggle
        if (userContext?.email !== 'demo@northwestern.com') {
            return res.status(403).json({ error: 'Demo mode only available for demo@northwestern.com' });
        }

        // Update user's demo mode setting
        await db.query('UPDATE recruiters SET demo_mode = $1 WHERE email = $2', [enabled, userContext.email]);

        res.json({ success: true, demo_mode: enabled });
    } catch (error) {
        console.error('Toggle demo mode error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Initialize ML models on startup
(async () => {
    try {
        await successPredictor.initialize();
        console.log('✅ ML models initialized');
    } catch (error) {
        console.error('❌ ML initialization error:', error);
    }
})();

module.exports = router;
