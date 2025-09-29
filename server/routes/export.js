const router = require('express').Router();
const exportController = require('../controllers/exportController');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/pdf', exportController.exportPDF);
router.post('/csv', exportController.exportCSV);
router.get('/status/:exportId', exportController.getExportStatus);

module.exports = router;
