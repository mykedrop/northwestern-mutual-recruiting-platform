const router = require('express').Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const enhancedAuthController = require('../controllers/enhancedAuthController');
const authMiddleware = require('../middleware/auth');

// Enhanced validation rules for enterprise security
const registerValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 12 }).withMessage('Password must be at least 12 characters'),
    body('firstName').notEmpty().trim().isLength({ min: 2, max: 50 }),
    body('lastName').notEmpty().trim().isLength({ min: 2, max: 50 }),
    body('department').optional().trim().isLength({ max: 100 }),
    body('role').optional().trim().isIn(['admin', 'recruiter', 'manager', 'viewer'])
];

const loginValidation = [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
    body('mfaCode').optional().isLength({ min: 6, max: 6 }).isNumeric()
];

const passwordChangeValidation = [
    body('currentPassword').notEmpty(),
    body('newPassword').isLength({ min: 12 }).withMessage('Password must be at least 12 characters')
];

// Enhanced Routes with Enterprise Security (temporarily using legacy for login)
router.post('/register', registerValidation, authController.register);  // Using legacy temporarily
router.post('/login', loginValidation, authController.login);  // Using legacy for now
router.post('/refresh', authController.refresh);  // Using legacy for now
router.get('/status', authController.status);  // Auth status endpoint
router.get('/profile', authMiddleware, authController.profile);  // User profile endpoint
router.post('/logout', authController.logout);    // Using legacy for now
// router.post('/change-password', passwordChangeValidation, enhancedAuthController.changePassword);  // Temporarily disabled

// MFA Routes - Required for Northwestern Mutual Compliance

const mfaValidation = [
    body('token').isLength({ min: 6, max: 6 }).isNumeric().withMessage('MFA token must be 6 digits')
];

router.post('/mfa/setup', authMiddleware, authController.setupMFA);
router.post('/mfa/verify', authMiddleware, mfaValidation, authController.verifyMFA);
router.post('/mfa/login', loginValidation, authController.loginWithMFA);
router.post('/mfa/disable', authMiddleware, mfaValidation, authController.disableMFA);

// Legacy routes for backward compatibility
router.post('/legacy/register', registerValidation, authController.register);
router.post('/legacy/login', loginValidation, authController.login);
router.post('/legacy/refresh', authController.refresh);

module.exports = router;
