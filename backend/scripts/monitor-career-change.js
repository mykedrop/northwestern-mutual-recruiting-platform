const { pool } = require('../db');

async function monitorCareerChangeSystem() {
  console.log('📊 Career Change System Monitor\n');
  console.log('='.repeat(50));
  
  try {
    // Get overall metrics
    const metrics = await pool.query('SELECT * FROM career_change_metrics');
    const m = metrics.rows[0];
    
    console.log('📈 Overall Performance:');
    console.log(`   Total Scored: ${m.total_scored}`);
    console.log(`   Average Score: ${parseFloat(m.avg_score || 0).toFixed(2)}`);
    console.log(`   High Scorers (>0.7): ${m.high_scorers}`);
    console.log(`   Tier Distribution: T1=${m.tier1_count} T2=${m.tier2_count} T3=${m.tier3_count}`);
    
    // Get profession performance
    const professions = await pool.query('SELECT * FROM profession_performance');
    
    console.log('\n👥 Profession Performance:');
    professions.rows.forEach(p => {
      console.log(`   ${p.profession_category} (Tier ${p.tier})`);
      console.log(`      Candidates: ${p.candidates_scored} | Avg Score: ${parseFloat(p.avg_score || 0).toFixed(2)}`);
    });
    
    // Get recent high scorers
    const highScorers = await pool.query(
      `SELECT sc.name, sc.title, sc.company, ccs.total_score, ccs.current_profession
       FROM career_changer_scores ccs
       JOIN sourced_candidates sc ON ccs.sourced_candidate_id = sc.id
       WHERE ccs.total_score >= 0.7
       ORDER BY ccs.last_calculated DESC
       LIMIT 5`
    );
    
    console.log('\n🌟 Recent High Scorers:');
    highScorers.rows.forEach(h => {
      console.log(`   ${h.name} - ${h.title} at ${h.company}`);
      console.log(`      Score: ${h.total_score} | Profession: ${h.current_profession}`);
    });
    
  } catch (error) {
    console.error('Error running monitor:', error);
  } finally {
    await pool.end();
  }
}

// Run monitor
monitorCareerChangeSystem();



