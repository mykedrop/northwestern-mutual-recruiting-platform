const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const db = require('../db');

class OpenAIService {
    constructor() {
        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });
        
        this.model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
        this.maxTokens = parseInt(process.env.MAX_TOKENS || '2000', 10);
        this.temperature = parseFloat(process.env.TEMPERATURE || '0.7');

        this.pinecone = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
            environment: process.env.PINECONE_ENVIRONMENT
        });
        
        this.index = null;
        this.initializePinecone();
    }

    async initializePinecone() {
        try {
            this.index = this.pinecone.Index(process.env.PINECONE_INDEX_NAME);
            console.log('✅ Pinecone initialized successfully');
        } catch (error) {
            console.error('❌ Pinecone initialization failed:', error);
        }
    }

    // Get candidate context for chatbot intelligence
    async getCandidateContext() {
        try {
            const candidatesQuery = await db.query(`
                SELECT 
                    c.id,
                    c.first_name,
                    c.last_name,
                    c.email,
                    c.phone,
                    c.assessment_status as status,
                    c.years_experience,
                    c.skills,
                    c.created_at,
                    ps.name as pipeline_stage,
                    a.completion_status as assessment_status,
                    a.end_time as assessment_completed,
                    COALESCE((
                        SELECT AVG(score) FROM dimension_scores ds 
                        WHERE ds.assessment_id = a.id
                    ), 0) as avg_assessment_score
                FROM candidates c
                LEFT JOIN candidate_pipeline cp ON c.id = cp.candidate_id
                LEFT JOIN pipeline_stages ps ON cp.stage_id = ps.id
                LEFT JOIN assessments a ON c.id = a.candidate_id
                ORDER BY c.created_at DESC
            `);

            const pipelineStats = await db.query(`
                SELECT 
                    ps.name as stage,
                    COUNT(cp.candidate_id) as count
                FROM pipeline_stages ps
                LEFT JOIN candidate_pipeline cp ON ps.id = cp.stage_id
                GROUP BY ps.id, ps.name
                ORDER BY ps.position
            `);

            const recentActivity = await db.query(`
                SELECT 
                    'New Candidate' as activity_type,
                    CONCAT(first_name, ' ', last_name) as description,
                    created_at as timestamp
                FROM candidates
                WHERE created_at > NOW() - INTERVAL '7 days'
                ORDER BY created_at DESC
                LIMIT 10
            `);

            return {
                candidates: candidatesQuery.rows,
                pipelineStats: pipelineStats.rows,
                recentActivity: recentActivity.rows,
                totalCandidates: candidatesQuery.rows.length,
                completedAssessments: candidatesQuery.rows.filter(c => c.assessment_status === 'completed').length
            };
        } catch (error) {
            console.error('Error getting candidate context:', error);
            return { candidates: [], pipelineStats: [], recentActivity: [], totalCandidates: 0, completedAssessments: 0 };
        }
    }

    // Generate intelligent chatbot response with context
    async generateChatbotResponse(message, sessionContext = {}) {
        try {
            const context = await this.getCandidateContext();
            const systemPrompt = `You are an intelligent recruiting assistant for Northwestern Mutual.\n\n` +
                `Current System Status:\n` +
                `- Total Candidates: ${context.totalCandidates}\n` +
                `- Completed Assessments: ${context.completedAssessments}\n` +
                `- Pipeline Distribution: ${context.pipelineStats.map(s => `${s.stage}: ${s.count}`).join(', ')}\n\n` +
                `Candidate Data Available (sample):\n${JSON.stringify(context.candidates.slice(0, 10))}\n\n` +
                `Instructions:\n` +
                `1. Provide specific, data-driven insights when asked about candidates\n` +
                `2. Use actual candidate names and scores when relevant\n` +
                `3. Identify patterns and trends in the data\n` +
                `4. Make recommendations based on assessment scores and pipeline status\n` +
                `5. Be helpful and specific, not generic`;

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: message }
                ],
                temperature: this.temperature,
                max_tokens: this.maxTokens
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('OpenAI API error:', error);
            if ((error.message || '').toLowerCase().includes('api key')) {
                return "I'm having trouble connecting to the AI service. Please check that the OpenAI API key is configured correctly.";
            }
            return 'I encountered an error while processing your request. Please try again.';
        }
    }

    // Analyze a specific candidate
    async analyzeCandiate(candidateId) {
        try {
            const candidateQuery = await db.query(`
                SELECT 
                    c.*,
                    a.completion_status as assessment_status,
                    json_agg(
                        json_build_object(
                            'dimension', ds.dimension_name,
                            'score', ds.score,
                            'percentile', ds.percentile
                        )
                    ) as dimension_scores
                FROM candidates c
                LEFT JOIN assessments a ON c.id = a.candidate_id
                LEFT JOIN dimension_scores ds ON a.id = ds.assessment_id
                WHERE c.id = $1
                GROUP BY c.id, a.completion_status
            `, [candidateId]);

            if (candidateQuery.rows.length === 0) {
                return 'Candidate not found.';
            }

            const candidate = candidateQuery.rows[0];
            const prompt = `Analyze this candidate for a Financial Advisor role at Northwestern Mutual:\n\n` +
                `Name: ${candidate.first_name} ${candidate.last_name}\n` +
                `Email: ${candidate.email}\n` +
                `Experience: ${candidate.years_experience || 0} years\n` +
                `Skills: ${(candidate.skills || []).join(', ')}\n` +
                `Assessment Status: ${candidate.assessment_status || 'Not completed'}\n` +
                `Dimension Scores: ${JSON.stringify(candidate.dimension_scores)}\n\n` +
                `Provide:\n` +
                `1. Overall fit assessment (1-10 scale)\n` +
                `2. Top 3 strengths\n` +
                `3. Top 3 areas for development\n` +
                `4. Specific interview questions to ask\n` +
                `5. Hiring recommendation with justification`;

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    { role: 'system', content: 'You are an expert recruiter analyzing candidates for Northwestern Mutual.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.5,
                max_tokens: 1000
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('Candidate analysis error:', error);
            return 'Unable to analyze candidate at this time.';
        }
    }

    // Generate embeddings for text
    async generateEmbedding(text) {
        try {
            const response = await this.openai.embeddings.create({
                model: "text-embedding-ada-002",
                input: text
            });
            return response.data[0].embedding;
        } catch (error) {
            console.error('Embedding generation error:', error);
            throw error;
        }
    }

    // Generate candidate summary using GPT-4
    async generateCandidateSummary(candidateData) {
        const prompt = `
        Analyze this candidate profile and provide a comprehensive summary:
        
        Name: ${candidateData.name}
        Experience: ${candidateData.experience}
        Skills: ${candidateData.skills.join(', ')}
        Assessment Results: ${JSON.stringify(candidateData.assessmentScores)}
        
        Provide:
        1. Executive Summary (2-3 sentences)
        2. Key Strengths (top 3)
        3. Potential Concerns (if any)
        4. Cultural Fit Assessment for Northwestern Mutual
        5. Recommended Next Steps
        `;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert recruiter analyzing candidates for Northwestern Mutual. Provide insights that are actionable and specific."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            return response.choices[0].message.content;
        } catch (error) {
            console.error('GPT-4 summary generation error:', error);
            throw error;
        }
    }

    // Store candidate embedding in Pinecone
    async storeCandidateEmbedding(candidateId, embedding, metadata) {
        try {
            await this.index.upsert([
                {
                    id: `candidate_${candidateId}`,
                    values: embedding,
                    metadata: metadata
                }
            ]);
            return true;
        } catch (error) {
            console.error('Pinecone storage error:', error);
            throw error;
        }
    }

    // Search for similar candidates
    async findSimilarCandidates(embedding, topK = 10) {
        try {
            const results = await this.index.query({
                vector: embedding,
                topK: topK,
                includeMetadata: true
            });
            return results.matches;
        } catch (error) {
            console.error('Similarity search error:', error);
            throw error;
        }
    }

    // Generate interview questions
    async generateInterviewQuestions(candidateData, role) {
        const prompt = `
        Generate 7 tailored interview questions for this candidate:
        
        Role: ${role}
        Candidate Background: ${JSON.stringify(candidateData)}
        
        Include:
        - 2 behavioral questions
        - 2 technical/skill verification questions
        - 1 cultural fit question
        - 1 growth potential question
        - 1 situation/problem-solving question
        
        Make questions specific to their background and the role requirements.
        `;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are an expert interviewer. Generate insightful, role-specific questions."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 800
            });

            const content = response.choices[0].message.content;
            return content.split('\n').filter(q => q.trim().length > 0);
        } catch (error) {
            console.error('Question generation error:', error);
            throw error;
        }
    }

    // Parse resume using GPT-4
    async parseResume(resumeText) {
        const prompt = `
        Extract structured information from this resume:
        
        ${resumeText}
        
        Return a JSON object with:
        - name
        - email
        - phone
        - location
        - currentTitle
        - currentCompany
        - yearsExperience
        - skills (array)
        - education (array of objects with degree, institution, year)
        - experience (array of objects with title, company, duration, achievements)
        - certifications (array)
        `;

        try {
            const response = await this.openai.chat.completions.create({
                model: "gpt-4-turbo-preview",
                messages: [
                    {
                        role: "system",
                        content: "You are a resume parser. Extract information and return valid JSON only."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 1500,
                response_format: { type: "json_object" }
            });

            return JSON.parse(response.choices[0].message.content);
        } catch (error) {
            console.error('Resume parsing error:', error);
            throw error;
        }
    }
}

module.exports = new OpenAIService();

