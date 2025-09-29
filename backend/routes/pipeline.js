const router = require('express').Router();
const pipelineController = require('../controllers/pipelineController');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/stages', pipelineController.getPipelineStages);
router.get('/view', pipelineController.getPipelineView);
router.post('/move', pipelineController.moveCandidate);
router.post('/bulk-move', pipelineController.bulkMoveCandidate);

module.exports = router;
