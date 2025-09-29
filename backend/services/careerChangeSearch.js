const LinkedInSearchService = require('./sourcing/linkedinSearch');
const { pool } = require('../db');

class CareerChangeSearchService {
  constructor() {
    this.linkedInService = new LinkedInSearchService();
  }

  /**
   * Generate LinkedIn search queries for each profession
   */
  async generateProfessionQueries(location = 'Milwaukee, WI', radius = 25) {
    const result = await pool.query(
      'SELECT * FROM profession_mappings WHERE active = true ORDER BY tier ASC'
    );
    
    const professions = result.rows;
    const queries = [];
    
    for (const profession of professions) {
      // Generate multiple query variants for better coverage
      const baseQueries = this.buildQueriesForProfession(profession, location, radius);
      queries.push(...baseQueries);
    }
    
    return queries;
  }

  /**
   * Build specific queries for a profession
   */
  buildQueriesForProfession(profession, location, radius) {
    const queries = [];
    
    // Query 1: Current titles
    if (profession.current_titles?.length > 0) {
      queries.push({
        profession: profession.profession_category,
        tier: profession.tier,
        title: profession.current_titles[0], // Use first title as primary
        keywords: profession.current_titles.slice(1, 3), // Additional titles as keywords
        type: 'title_based'
      });
    }
    
    // Query 2: Industry + keywords
    if (profession.search_keywords?.length > 0) {
      queries.push({
        profession: profession.profession_category,
        tier: profession.tier,
        title: profession.search_keywords[0],
        keywords: profession.search_keywords.slice(1, 2),
        type: 'keyword_based'
      });
    }
    
    return queries;
  }

  /**
   * Execute search for specific profession
   */
  async searchProfession(professionCategory, location = 'Milwaukee, WI', limit = 50) {
    const result = await pool.query(
      'SELECT * FROM profession_mappings WHERE profession_category = $1',
      [professionCategory]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Profession not found');
    }
    
    const profession = result.rows[0];
    const queries = this.buildQueriesForProfession(profession, location, 25);
    
    const allResults = [];
    for (const queryObj of queries) {
      try {
        const searchResponse = await this.linkedInService.searchProfiles({
          title: queryObj.title,
          location: location,
          keywords: queryObj.keywords || []
        }, 1, limit);
        
        const results = searchResponse.items || [];
        
        // Parse and tag results with profession info
        const taggedResults = results.map(r => {
          const parsed = this.linkedInService.parseSearchResult(r);
          return {
            ...parsed,
            profession_category: profession.profession_category,
            profession_tier: profession.tier,
            query_type: queryObj.type,
            is_career_changer: true
          };
        });
        
        allResults.push(...taggedResults);
      } catch (error) {
        console.error(`Error searching with title: ${queryObj.title}`, error);
      }
    }
    
    // Deduplicate by LinkedIn URL
    const uniqueResults = this.deduplicateResults(allResults);
    
    // Store in sourced_candidates
    await this.storeCandidates(uniqueResults, professionCategory);
    
    return uniqueResults;
  }

  /**
   * Search all professions in priority order
   */
  async searchAllProfessions(location = 'Milwaukee, WI', limitPerProfession = 20) {
    const result = await pool.query(
      'SELECT * FROM profession_mappings WHERE active = true ORDER BY tier ASC'
    );
    
    const professions = result.rows;
    const allResults = {
      tier1: [],
      tier2: [],
      tier3: []
    };
    
    for (const profession of professions) {
      const results = await this.searchProfession(
        profession.profession_category,
        location,
        limitPerProfession
      );
      
      const tierKey = `tier${profession.tier}`;
      allResults[tierKey].push(...results);
    }
    
    return allResults;
  }

  /**
   * Deduplicate results by LinkedIn URL
   */
  deduplicateResults(results) {
    const seen = new Set();
    return results.filter(r => {
      const url = r.linkedin_url || r.url;
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });
  }

  /**
   * Store career change candidates
   */
  async storeCandidates(candidates, professionCategory) {
    for (const candidate of candidates) {
      try {
        await pool.query(
          `INSERT INTO sourced_candidates (
            source_platform, full_name, name, title, company, location, linkedin_url,
            is_career_changer, previous_profession, source,
            campaign_id, profile_data
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (linkedin_url) DO UPDATE SET
            is_career_changer = true,
            previous_profession = $9,
            updated_at = NOW()`,
          [
            'linkedin', // source_platform (required field)
            candidate.name, // full_name (required field)
            candidate.name,
            candidate.title,
            candidate.company,
            candidate.location,
            candidate.linkedin_url || candidate.url,
            true,
            professionCategory,
            'career_change_search',
            null, // campaign_id - will be set when campaign is created
            candidate // Store full profile data
          ]
        );
      } catch (error) {
        console.error('Error storing candidate:', error);
      }
    }
  }
}

module.exports = CareerChangeSearchService;
