const router = require('express').Router();
const dashboardController = require('../controllers/dashboardController');
const auth = require('../middleware/auth');

// All dashboard routes require authentication
router.use(auth);

router.get('/overview', dashboardController.getDashboardOverview);
router.get('/candidates', dashboardController.getCandidates);
router.get('/candidate/:candidateId', dashboardController.getCandidateDetail);
router.post('/compare', dashboardController.compareCandidates);
router.get('/analytics', dashboardController.getAnalytics);

module.exports = router;
