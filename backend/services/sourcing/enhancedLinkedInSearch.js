const NodeCache = require('node-cache');
const searchCache = new NodeCache({ stdTTL: 600 });

class EnhancedLinkedInSearch {
    constructor() {
        this.nmTargets = {
            careerChangers: {
                teachers: {
                    keywords: ['teacher', 'educator', 'instructor', 'professor'],
                    yearsExperience: 5,
                    burnoutIndicators: ['seeking new opportunities', 'career transition', 'exploring options'],
                    scoringBoost: 1.5
                },
                consultants: {
                    keywords: ['consultant', 'analyst', 'associate'],
                    companies: ['Deloitte', 'PwC', 'EY', 'KPMG', 'McKinsey', 'BCG', 'Bain'],
                    travelFatigue: ['work life balance', 'remote', 'less travel'],
                    scoringBoost: 1.4
                },
                military: {
                    keywords: ['veteran', 'military', 'officer', 'sergeant'],
                    transition: ['transitioning', 'retiring', 'civilian career'],
                    scoringBoost: 1.6
                }
            },
            competitors: {
                edwardJones: { company: 'Edward Jones', boost: 2.0 },
                ameriprise: { company: 'Ameriprise', boost: 1.8 },
                wellsFargo: { company: 'Wells Fargo Advisors', boost: 1.7 }
            }
        };
    }

    async search(params) {
        const { title, location, keywords, page = 1, limit = 12, targetType = 'general' } = params;

        // Check cache
        const cacheKey = `${title}-${location}-${keywords}-${page}-${targetType}`;
        const cached = searchCache.get(cacheKey);
        if (cached) return { ...cached, cached: true };

        // Build enhanced query for NM targeting
        let enhancedQuery = this.buildNMQuery(title, location, keywords, targetType);

        // Perform search with pagination
        const offset = (page - 1) * limit;
        const results = await this.performSearch(enhancedQuery, limit, offset);

        // Score and rank results for NM
        const scoredResults = this.scoreForNM(results, targetType);

        // Prepare response
        const response = {
            candidates: scoredResults,
            page: page,
            totalPages: Math.ceil(results.total / limit),
            totalResults: results.total,
            perPage: limit,
            cached: false,
            targetingApplied: targetType
        };

        // Cache results
        searchCache.set(cacheKey, response);

        return response;
    }

    buildNMQuery(title, location, keywords, targetType) {
        let query = `${title || ''} ${location || ''} ${keywords || ''}`;

        if (targetType === 'careerChangers') {
            query += ' ("seeking new opportunities" OR "career transition" OR "open to opportunities")';
        } else if (targetType === 'competitors') {
            const companies = Object.values(this.nmTargets.competitors).map(c => c.company);
            query += ` (${companies.map(c => `"${c}"`).join(' OR ')})`;
        } else if (targetType === 'teachers') {
            query += ' (teacher OR educator) "looking for change"';
        }

        return query.trim();
    }

    scoreForNM(results, targetType) {
        return results.map(candidate => {
            let score = candidate.baseScore || 50;

            // Apply NM-specific scoring boosts
            if (targetType === 'careerChangers') {
                if (this.isTeacher(candidate)) score *= 1.5;
                if (this.isConsultant(candidate)) score *= 1.4;
                if (this.isMilitary(candidate)) score *= 1.6;
            }

            if (targetType === 'competitors') {
                Object.entries(this.nmTargets.competitors).forEach(([key, config]) => {
                    if (candidate.company?.includes(config.company)) {
                        score *= config.boost;
                    }
                });
            }

            // Location boost for Milwaukee area
            if (candidate.location?.match(/Milwaukee|Madison|Chicago/i)) {
                score *= 1.2;
            }

            return {
                ...candidate,
                nmScore: Math.min(100, score),
                recommendation: this.getRecommendation(score),
                priority: score >= 80 ? 'HIGH' : score >= 60 ? 'MEDIUM' : 'LOW'
            };
        }).sort((a, b) => b.nmScore - a.nmScore);
    }

    getRecommendation(score) {
        if (score >= 85) return '🔥 IMMEDIATE CONTACT - Perfect fit';
        if (score >= 70) return '⭐ STRONG CANDIDATE - Contact this week';
        if (score >= 55) return '✓ QUALIFIED - Add to pipeline';
        return '📋 NURTURE - Long-term potential';
    }

    isTeacher(candidate) {
        const teacherKeywords = ['teacher', 'educator', 'professor', 'instructor'];
        return teacherKeywords.some(keyword =>
            candidate.title?.toLowerCase().includes(keyword) ||
            candidate.experience?.toLowerCase().includes(keyword)
        );
    }

    isConsultant(candidate) {
        const consultingFirms = ['deloitte', 'pwc', 'ey', 'kpmg', 'mckinsey', 'bcg', 'bain', 'accenture'];
        return consultingFirms.some(firm =>
            candidate.company?.toLowerCase().includes(firm)
        );
    }

    isMilitary(candidate) {
        const militaryKeywords = ['veteran', 'military', 'army', 'navy', 'air force', 'marines', 'coast guard'];
        return militaryKeywords.some(keyword =>
            candidate.experience?.toLowerCase().includes(keyword)
        );
    }

    async performSearch(query, limit, offset) {
        // This connects to your existing LinkedIn search API
        // Implement based on your current setup
        try {
            const LinkedInSearchService = require('./linkedinSearch');
            const searchService = new LinkedInSearchService();

            // Use the existing searchProfiles method
            const startIndex = offset || 1;
            const result = await searchService.searchProfiles({
                title: query,
                location: '',
                keywords: ''
            }, startIndex, limit);

            return {
                items: result.items || [],
                total: result.totalResults || 0
            };
        } catch (error) {
            console.error('Enhanced search error:', error);
            return {
                items: [],
                total: 0
            };
        }
    }
}

module.exports = new EnhancedLinkedInSearch();