const pool = require('../../config/database');

class SignalDetectionService {
  constructor() {
    this.signalWeights = {
      open_to_work_badge: 1.0,
      looking_in_bio: 0.9,
      recent_profile_update: 0.7,
      multiple_job_views: 0.6,
      former_in_title: 0.8,
      actively_applying: 0.9,
      posted_resume: 0.8
    };
  }

  async detectLinkedInSignals(candidate) {
    const signals = [];
    const snippet = candidate.snippet || '';
    const title = candidate.title || '';

    if (snippet.includes('#OpenToWork') || snippet.toLowerCase().includes('open to work')) {
      signals.push({
        type: 'open_to_work_badge',
        strength: this.signalWeights.open_to_work_badge,
        data: { detected_in: 'snippet' }
      });
    }

    const lookingPhrases = [
      'looking for',
      'seeking new',
      'open to',
      'interested in',
      'exploring opportunities'
    ];

    for (const phrase of lookingPhrases) {
      if (snippet.toLowerCase().includes(phrase)) {
        signals.push({
          type: 'looking_in_bio',
          strength: this.signalWeights.looking_in_bio,
          data: { phrase_found: phrase }
        });
        break;
      }
    }

    if (title.toLowerCase().includes('former') || title.toLowerCase().includes('ex-')) {
      signals.push({
        type: 'former_in_title',
        strength: this.signalWeights.former_in_title,
        data: { title }
      });
    }

    return signals;
  }

  calculateJobSeekingScore(signals) {
    if (signals.length === 0) return 0;
    const maxStrength = Math.max(...signals.map(s => s.strength));
    const multiSignalBonus = Math.min(0.2, signals.length * 0.05);
    return Math.min(1.0, maxStrength + multiSignalBonus);
  }

  async saveSignals(candidateId, signals) {
    for (const signal of signals) {
      await pool.query(
        `INSERT INTO job_seeking_signals 
         (candidate_id, signal_type, signal_strength, signal_data, expires_at)
         VALUES ($1, $2, $3, $4, NOW() + INTERVAL '30 days')
         ON CONFLICT (candidate_id, signal_type) 
         DO UPDATE SET 
           signal_strength = $3,
           signal_data = $4,
           detected_at = NOW(),
           expires_at = NOW() + INTERVAL '30 days'`,
        [candidateId, signal.type, signal.strength, JSON.stringify(signal.data)]
      );
    }
  }

  async scanAllCandidates() {
    const candidatesResult = await pool.query(
      'SELECT * FROM sourced_candidates WHERE status = $1',
      ['new']
    );

    const results = {
      scanned: 0,
      signals_found: 0,
      high_priority: []
    };

    for (const candidate of candidatesResult.rows) {
      const signals = await this.detectLinkedInSignals(candidate);

      if (signals.length > 0) {
        await this.saveSignals(candidate.id, signals);
        const score = this.calculateJobSeekingScore(signals);

        results.signals_found++;

        if (score >= 0.8) {
          results.high_priority.push({
            candidateId: candidate.id,
            name: candidate.name,
            score
          });
        }
      }

      results.scanned++;
    }

    return results;
  }

  async getActiveJobSeekers(minScore = 0.7) {
    const result = await pool.query(`
      SELECT 
        sc.*,
        AVG(jss.signal_strength) as avg_signal_strength,
        COUNT(jss.id) as signal_count,
        json_agg(json_build_object(
          'type', jss.signal_type,
          'strength', jss.signal_strength,
          'detected_at', jss.detected_at
        )) as signals
      FROM sourced_candidates sc
      JOIN job_seeking_signals jss ON sc.id = jss.candidate_id
      WHERE jss.expires_at > NOW()
      GROUP BY sc.id
      HAVING AVG(jss.signal_strength) >= $1
      ORDER BY AVG(jss.signal_strength) DESC
    `, [minScore]);

    return result.rows;
  }
}

module.exports = SignalDetectionService;





