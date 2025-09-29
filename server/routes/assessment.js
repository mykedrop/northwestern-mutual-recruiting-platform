const router = require('express').Router();
const assessmentController = require('../controllers/assessmentController');
const auth = require('../middleware/auth');

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

module.exports = router;

