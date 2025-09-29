const router = require('express').Router();
const assessmentController = require('../controllers/assessmentController');
const auth = require('../middleware/auth');

// Protected assessment endpoints
router.get('/', auth, assessmentController.getAllAssessments);

// PUBLIC assessment endpoints (simple candidate flow: start using candidateId)
// These endpoints intentionally do not require auth for easier candidate access.
// Use rate limiting at /api level and validate inputs server-side.
router.post('/public/start', assessmentController.startAssessment);
router.post('/public/response', assessmentController.saveResponse);
router.post('/public/complete', assessmentController.completeAssessment);
router.get('/public/launch/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    req.body.candidateId = candidateId;
    // Reuse controller to ensure single place of truth
    const start = await new Promise((resolve, reject) => {
      // Fake res to capture JSON
      const fakeRes = {
        json: resolve,
        status: (code) => ({ json: (obj) => reject({ code, obj }) })
      };
      assessmentController.startAssessment({ body: { candidateId } }, fakeRes)
        .catch(reject);
    });
    const url = `/assessment.html?candidateId=${encodeURIComponent(candidateId)}&assessmentId=${encodeURIComponent(start.assessmentId)}`;
    res.json({ success: true, assessmentId: start.assessmentId, candidateId, url });
  } catch (e) {
    res.status(500).json({ success: false, error: e.obj?.error || e.message });
  }
});

// Authenticated assessment endpoints (for internal tools/dashboard)
router.use(auth);

router.post('/start', assessmentController.startAssessment);
router.post('/response', assessmentController.saveResponse);
router.post('/complete', assessmentController.completeAssessment);
router.get('/results/:assessmentId', assessmentController.getAssessmentResults);
router.get('/intelligence/:assessmentId', assessmentController.getIntelligenceReport);
router.get('/by-candidate/:candidateId', async (req, res) => {
  try {
    const { candidateId } = req.params;
    const db = require('../config/database');
    const result = await db.query(
      'SELECT * FROM assessments WHERE candidate_id = $1 ORDER BY created_at DESC LIMIT 1',
      [candidateId]
    );

    if (result.rows.length === 0) {
      // Check if this is demo mode or if we should return demo data
      const isDemoMode = process.env.DEMO_MODE === 'true';

      if (isDemoMode) {
        // Return demo assessment data for candidates without assessments
        const demoAssessment = {
          id: `demo-assessment-${candidateId}`,
          candidate_id: candidateId,
          status: 'completed',
          created_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          total_score: Math.floor(Math.random() * 30) + 70, // 70-100 range
          progress: 100,
          responses: {},
          personality_profile: {
            mbti: 'ESFJ',
            disc: 'I/S Profile',
            enneagram: 'Type 2 - The Helper'
          },
          demo_mode: true
        };

        console.log(`📊 Returning demo assessment for candidate ${candidateId}`);
        return res.json(demoAssessment);
      }

      return res.status(404).json({ error: 'No assessment found for this candidate' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting assessment by candidate:', error);
    res.status(500).json({ error: 'Failed to get assessment' });
  }
});

// Mock intelligence reports for our demo candidates
router.get('/intelligence/demo/:assessmentId', async (req, res) => {
  try {
    const { assessmentId } = req.params;

    // Get dimensional scores for this assessment
    const scores = await require('../config/database').query(
      'SELECT dimension, score, percentile FROM dimension_scores WHERE assessment_id = $1',
      [assessmentId]
    );

    const dimensionScores = {};
    scores.rows.forEach(row => {
      dimensionScores[row.dimension] = { score: row.score, percentile: row.percentile };
    });

    // Calculate overall score
    const avgScore = scores.rows.length > 0
      ? Math.round(scores.rows.reduce((sum, row) => sum + row.score, 0) / scores.rows.length)
      : 50;

    // Generate intelligence report based on scores
    const report = {
      assessmentId,
      overallScore: avgScore,
      fitScore: Math.min(95, avgScore + Math.floor(Math.random() * 10) - 5),
      dimensionScores,
      personalityProfile: {
        mbti: avgScore >= 85 ? 'ESFJ' : avgScore >= 75 ? 'INTJ' : 'ESTP',
        disc: avgScore >= 85 ? 'I/S Profile' : avgScore >= 75 ? 'C/D Profile' : 'D/I Profile',
        enneagram: avgScore >= 85 ? 'Type 2 - The Helper' : avgScore >= 75 ? 'Type 5 - The Investigator' : 'Type 8 - The Challenger'
      },
      strengths: avgScore >= 85 ? [
        'Outstanding ethical standards',
        'Exceptional relationship building',
        'Superior social calibration',
        'High emotional regulation'
      ] : avgScore >= 75 ? [
        'Exceptional learning orientation',
        'Outstanding systems thinking',
        'Superior cognitive flexibility',
        'Excellent self management'
      ] : [
        'High achievement drive',
        'Strong influence style'
      ],
      concerns: avgScore >= 85 ? [
        'May be overly cautious with innovation'
      ] : avgScore >= 75 ? [
        'Needs relationship building development',
        'Requires interpersonal skill training'
      ] : [
        'Ethical concerns',
        'Poor learning orientation',
        'Team collaboration issues'
      ],
      recommendation: avgScore >= 85 ? 'STRONG HIRE' : avgScore >= 75 ? 'HIRE WITH DEVELOPMENT' : 'DO NOT HIRE',
      riskLevel: avgScore >= 85 ? 'LOW' : avgScore >= 75 ? 'MEDIUM' : 'HIGH',
      faFitScore: avgScore >= 85 ? 93 : avgScore >= 75 ? 85 : 32,
      onboardingPlan: avgScore >= 85 ? [
        'Fast-track to client-facing roles',
        'Consider for leadership development',
        'Provide advanced planning courses'
      ] : avgScore >= 75 ? [
        'Intensive relationship training',
        'Pair with experienced mentor',
        'Sales techniques development'
      ] : [
        'Not recommended for FA role',
        'Significant behavioral coaching required'
      ]
    };

    res.json(report);
  } catch (error) {
    console.error('Error generating demo intelligence report:', error);
    res.status(500).json({ error: 'Failed to generate intelligence report' });
  }
});

module.exports = router;

