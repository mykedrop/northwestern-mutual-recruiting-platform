const router = require('express').Router();
const employeeAssessmentController = require('../controllers/employeeAssessmentController');
const auth = require('../middleware/auth');

// All employee assessment endpoints require authentication
router.use(auth);

// Employee management endpoints
router.get('/employees', employeeAssessmentController.getAllEmployees);

// Employee assessment endpoints
router.post('/start', employeeAssessmentController.startEmployeeAssessment);
router.get('/results/:assessmentId', employeeAssessmentController.getEmployeeAssessmentResults);

// Comparison baseline management
router.get('/baselines', employeeAssessmentController.getComparisonBaselines);
router.post('/baselines', employeeAssessmentController.createComparisonBaseline);

// Candidate comparison endpoints
router.post('/compare', employeeAssessmentController.compareCandidateToBaseline);
router.get('/comparisons/:candidateId', employeeAssessmentController.getCandidateComparisons);

module.exports = router;