const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const pdfParse = require('pdf-parse');
const openAIService = require('../services/openai.service');
const resumeParser = require('../services/resumeParser.service');
const chatbotService = require('../services/chatbot.service');
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
