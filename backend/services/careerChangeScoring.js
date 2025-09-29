const { pool } = require('../db');
const SignalDetectionService = require('./sourcing/signalDetection');

class CareerChangeScoringService {
  constructor() {
    this.signalService = new SignalDetectionService();
  }

  /**
   * Calculate career change score for a candidate
   * @param {number} candidateId - Either candidates.id or sourced_candidates.id
   * @param {string} sourceTable - 'candidates' or 'sourced_candidates'
   */
  async calculateCareerChangeScore(candidateId, sourceTable = 'sourced_candidates') {
    try {
      // 1. Get candidate data
      const candidateQuery = sourceTable === 'candidates' 
        ? 'SELECT * FROM candidates WHERE id = $1'
        : 'SELECT * FROM sourced_candidates WHERE id = $1';
      
      const candidateResult = await pool.query(candidateQuery, [candidateId]);
      const candidate = candidateResult.rows[0];
      
      if (!candidate) {
        throw new Error('Candidate not found');
      }

      // 2. Identify profession and tier
      const profession = await this.identifyProfession(candidate);
      
      // 3. Calculate component scores
      const scores = {
        profession_match: await this.calculateProfessionMatch(candidate, profession),
        industry_distress: await this.calculateIndustryDistress(candidate),
        personal_readiness: await this.calculatePersonalReadiness(candidate, candidateId, sourceTable),
        skill_overlap: await this.calculateSkillOverlap(candidate, profession)
      };

      // 4. Calculate weighted total score
      const weights = {
        profession_match: 0.30,
        industry_distress: 0.20,
        personal_readiness: 0.25,
        skill_overlap: 0.25
      };

      const totalScore = Object.keys(scores).reduce((total, key) => {
        return total + (scores[key] * weights[key]);
      }, 0);

      // 5. Determine messaging angle based on scores
      const messagingAngle = this.determineMessagingAngle(scores, profession);

      // 6. Store the score
      const scoreData = {
        candidateId: sourceTable === 'candidates' ? candidateId : null,
        sourcedCandidateId: sourceTable === 'sourced_candidates' ? candidateId : null,
        currentProfession: profession?.profession_category || 'Unknown',
        professionTier: profession?.tier || 3,
        yearsInProfession: this.extractYearsExperience(candidate),
        ...scores,
        totalScore: totalScore.toFixed(2),
        scoreBreakdown: {
          scores,
          weights,
          calculations: {
            profession: profession,
            reasoning: this.explainScoring(scores, profession)
          }
        },
        messagingAngle
      };

      await this.storeScore(scoreData);
      
      // 7. Update sourced_candidates if applicable
      if (sourceTable === 'sourced_candidates') {
        await pool.query(
          `UPDATE sourced_candidates 
           SET is_career_changer = true, 
               career_change_score = $1,
               previous_profession = $2,
               years_in_profession = $3
           WHERE id = $4`,
          [totalScore.toFixed(2), profession?.profession_category, this.extractYearsExperience(candidate), candidateId]
        );
      }

      return scoreData;
      
    } catch (error) {
      console.error('Error calculating career change score:', error);
      throw error;
    }
  }

  /**
   * Identify which profession category the candidate belongs to
   */
  async identifyProfession(candidate) {
    const result = await pool.query('SELECT * FROM profession_mappings WHERE active = true');
    const professions = result.rows;
    
    const title = (candidate.title || candidate.current_role || candidate.current_title || '').toLowerCase();
    const company = (candidate.company || candidate.current_company || '').toLowerCase();
    
    // Score each profession based on title/company match
    let bestMatch = null;
    let bestScore = 0;
    
    for (const profession of professions) {
      let score = 0;
      
      // Check title match
      for (const profTitle of profession.current_titles) {
        if (title.includes(profTitle.toLowerCase())) {
          score += 1;
        }
      }
      
      // Check industry match
      for (const industry of profession.industries) {
        if (company.includes(industry.toLowerCase()) || title.includes(industry.toLowerCase())) {
          score += 0.5;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = profession;
      }
    }
    
    return bestMatch;
  }

  /**
   * Calculate profession match score (how well they fit the target profession)
   */
  async calculateProfessionMatch(candidate, profession) {
    if (!profession) return 0.2; // Base score if no profession matched
    
    let score = 0.5; // Base score for matching a profession
    
    // Boost score based on tier
    if (profession.tier === 1) score += 0.3;
    else if (profession.tier === 2) score += 0.2;
    else if (profession.tier === 3) score += 0.1;
    
    // Check years of experience
    const yearsExperience = this.extractYearsExperience(candidate);
    if (yearsExperience >= profession.required_years_experience) {
      score += 0.2;
    }
    
    return Math.min(score, 1.0);
  }

  /**
   * Calculate industry distress score
   */
  async calculateIndustryDistress(candidate) {
    const company = candidate.company || candidate.current_company || '';
    
    // Try to find industry health score
    const result = await pool.query(
      'SELECT * FROM industry_health_scores ORDER BY overall_distress_score DESC'
    );
    
    const industries = result.rows;
    
    for (const industry of industries) {
      if (company.toLowerCase().includes(industry.industry_name.toLowerCase()) ||
          (candidate.title || '').toLowerCase().includes(industry.industry_name.toLowerCase())) {
        return industry.overall_distress_score;
      }
    }
    
    return 0.3; // Default moderate distress score
  }

  /**
   * Calculate personal readiness using existing signals
   */
  async calculatePersonalReadiness(candidate, candidateId, sourceTable) {
    if (sourceTable === 'sourced_candidates') {
      // Use existing signal detection
      const signals = await pool.query(
        `SELECT AVG(signal_strength) as avg_strength FROM job_seeking_signals WHERE candidate_id = $1 AND expires_at > NOW()`,
        [candidateId]
      );
      
      if (signals.rows.length > 0 && signals.rows[0].avg_strength) {
        // Convert signal strength (0-1) to readiness score
        return Math.min(signals.rows[0].avg_strength, 1.0);
      }
    }
    
    // Check for LinkedIn indicators
    const profileData = candidate.profile_data || candidate.linkedin_data || {};
    let readinessScore = 0.3; // Base score
    
    if (profileData.openToWork) readinessScore += 0.3;
    if (profileData.recentlyUpdated) readinessScore += 0.2;
    if (this.detectCareerPlateau(candidate)) readinessScore += 0.2;
    
    return Math.min(readinessScore, 1.0);
  }

  /**
   * Calculate skill overlap with financial advisor role
   */
  async calculateSkillOverlap(candidate, profession) {
    if (!profession) return 0.3;
    
    const financialAdvisorSkills = [
      'sales', 'relationship building', 'communication', 'consulting',
      'business development', 'client management', 'negotiation',
      'presentation', 'networking', 'problem solving'
    ];
    
    const candidateText = [
      candidate.title || '',
      candidate.summary || '',
      candidate.skills || '',
      JSON.stringify(candidate.profile_data || {})
    ].join(' ').toLowerCase();
    
    let matchCount = 0;
    for (const skill of financialAdvisorSkills) {
      if (candidateText.includes(skill)) {
        matchCount++;
      }
    }
    
    // Also check profession-specific transferable skills
    if (profession.key_skills) {
      for (const skill of profession.key_skills) {
        if (candidateText.includes(skill.toLowerCase())) {
          matchCount += 0.5;
        }
      }
    }
    
    return Math.min(matchCount / financialAdvisorSkills.length, 1.0);
  }

  /**
   * Detect if candidate is in career plateau
   */
  detectCareerPlateau(candidate) {
    const yearsInRole = this.extractYearsExperience(candidate);
    return yearsInRole >= 5; // 5+ years in same role indicates plateau
  }

  /**
   * Extract years of experience from candidate data
   */
  extractYearsExperience(candidate) {
    // Try multiple fields
    const experienceText = candidate.years_experience || 
                          candidate.experience || 
                          candidate.profile_data?.experience || 
                          '';
    
    const match = experienceText.toString().match(/(\d+)/);
    return match ? parseInt(match[1]) : 3; // Default to 3 years
  }

  /**
   * Determine best messaging angle based on scores
   */
  determineMessagingAngle(scores, profession) {
    const angles = [];
    
    if (scores.industry_distress > 0.6) {
      angles.push('industry_escape');
    }
    if (scores.personal_readiness > 0.7) {
      angles.push('ready_for_change');
    }
    if (scores.skill_overlap > 0.7) {
      angles.push('perfect_skill_fit');
    }
    if (profession?.tier === 1) {
      angles.push('proven_success_path');
    }
    
    // Return primary angle or default
    return angles[0] || 'general_opportunity';
  }

  /**
   * Explain scoring logic for transparency
   */
  explainScoring(scores, profession) {
    const explanations = [];
    
    if (scores.profession_match > 0.7) {
      explanations.push(`Strong match with ${profession?.profession_category} profile`);
    }
    if (scores.industry_distress > 0.6) {
      explanations.push('Industry showing signs of distress');
    }
    if (scores.personal_readiness > 0.7) {
      explanations.push('Strong signals of job seeking activity');
    }
    if (scores.skill_overlap > 0.7) {
      explanations.push('Excellent transferable skills for financial advisory');
    }
    
    return explanations;
  }

  /**
   * Store calculated score in database
   */
  async storeScore(scoreData) {
    const query = `
      INSERT INTO career_changer_scores (
        candidate_id, sourced_candidate_id, current_profession, profession_tier,
        years_in_profession, profession_match_score, industry_distress_score,
        personal_readiness_score, skill_overlap_score, total_score,
        score_breakdown, recommended_messaging_angle
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (sourced_candidate_id)
      DO UPDATE SET
        current_profession = $3,
        profession_tier = $4,
        years_in_profession = $5,
        profession_match_score = $6,
        industry_distress_score = $7,
        personal_readiness_score = $8,
        skill_overlap_score = $9,
        total_score = $10,
        score_breakdown = $11,
        recommended_messaging_angle = $12,
        last_calculated = NOW()
      RETURNING *`;
    
    const values = [
      scoreData.candidateId,
      scoreData.sourcedCandidateId,
      scoreData.currentProfession,
      scoreData.professionTier,
      scoreData.yearsInProfession,
      scoreData.profession_match,
      scoreData.industry_distress,
      scoreData.personal_readiness,
      scoreData.skill_overlap,
      scoreData.totalScore,
      scoreData.scoreBreakdown,
      scoreData.messagingAngle
    ];
    
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  /**
   * Bulk score multiple candidates
   */
  async bulkScoreCandidates(candidateIds, sourceTable = 'sourced_candidates') {
    const results = {
      success: [],
      failed: []
    };
    
    for (const id of candidateIds) {
      try {
        const score = await this.calculateCareerChangeScore(id, sourceTable);
        results.success.push({ id, score: score.totalScore });
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }
    
    return results;
  }

  /**
   * Get top career change candidates
   */
  async getTopCareerChangers(limit = 50, minScore = 0.6) {
    const query = `
      SELECT 
        ccs.*,
        sc.name,
        sc.email,
        sc.linkedin_url,
        sc.title,
        sc.company,
        pm.messaging_hooks
      FROM career_changer_scores ccs
      LEFT JOIN sourced_candidates sc ON ccs.sourced_candidate_id = sc.id
      LEFT JOIN profession_mappings pm ON ccs.current_profession = pm.profession_category
      WHERE ccs.total_score >= $1
      ORDER BY ccs.total_score DESC
      LIMIT $2`;
    
    const result = await pool.query(query, [minScore, limit]);
    return result.rows;
  }
}

module.exports = CareerChangeScoringService;
