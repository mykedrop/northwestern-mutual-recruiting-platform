const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const validator = require('validator');
const xss = require('xss');

// Rate limiting configurations
const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// General API rate limiting
const generalLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  1000, // limit each IP to 1000 requests per windowMs (increased for testing)
  'Too many requests from this IP, please try again later'
);

// Strict rate limiting for authentication endpoints - disabled in development
const authLimiter = process.env.NODE_ENV === 'development' ?
  (req, res, next) => next() : // Skip rate limiting in development
  createRateLimiter(
    15 * 60 * 1000, // 15 minutes
    500, // limit each IP to 500 login attempts per windowMs (increased for testing)
    'Too many authentication attempts, please try again later'
  );

// Rate limiting for search/sourcing endpoints
const searchLimiter = createRateLimiter(
  1 * 60 * 1000, // 1 minute
  200, // limit each IP to 200 search requests per minute (increased for testing)
  'Search rate limit exceeded, please wait before searching again'
);

// Helmet security headers configuration
const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.socket.io"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// XSS Protection middleware
const xssProtection = (req, res, next) => {
  if (req.body) {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        req.body[key] = xss(req.body[key], {
          whiteList: {
            b: [],
            i: [],
            em: [],
            strong: [],
            p: [],
            br: []
          },
          stripIgnoreTag: true,
          stripIgnoreTagBody: ['script']
        });
      }
    }
  }

  if (req.query) {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = xss(req.query[key]);
      }
    }
  }

  next();
};

// SQL Injection protection middleware
const sqlInjectionProtection = (req, res, next) => {
  // Skip SQL injection detection for AI chatbot endpoints
  if (req.path.includes('/chatbot/message')) {
    return next();
  }

  const checkForSQLInjection = (value) => {
    if (typeof value !== 'string') return false;

    // Enhanced SQL injection patterns for enterprise security
    const sqlPatterns = [
      // SQL keywords
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|TRUNCATE|GRANT|REVOKE)\b)/i,
      // Comment patterns
      /(--|\/\*|\*\/|#)/,
      // Classic injection patterns
      /(\b(OR|AND)\b\s+\d+\s*=\s*\d+)/i,
      /(\b(OR|AND)\b\s+['"]\w*['"]?\s*=\s*['"]\w*['"]?)/i,
      // Union-based injections
      /(UNION\s+(ALL\s+)?SELECT)/i,
      // Function calls that could be dangerous
      /(\b(EXEC|EXECUTE|SP_|XP_)\s*\()/i,
      // String concatenation that could indicate injection
      /(\|\||CONCAT\s*\()/i,
      // Semicolon followed by SQL keywords (like '; DROP TABLE)
      /(;\s*(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE))/i,
      // Quote escaping attempts
      /(['"]\s*;\s*['"]*\s*(SELECT|INSERT|UPDATE|DELETE|DROP))/i,
      // Hex encoding attempts
      /(0x[0-9a-f]+)/i,
      // Casting operations often used in SQL injection
      /(\bCAST\s*\(|\bCONVERT\s*\()/i
    ];

    const detectedPattern = sqlPatterns.find(pattern => pattern.test(value));

    if (detectedPattern) {
      console.warn(`🚨 SQL Injection attempt detected: "${value}" matched pattern: ${detectedPattern}`);
      return true;
    }

    return false;
  };

  const checkObject = (obj) => {
    for (const key in obj) {
      if (typeof obj[key] === 'string' && checkForSQLInjection(obj[key])) {
        return true;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        if (checkObject(obj[key])) return true;
      }
    }
    return false;
  };

  if (req.body && checkObject(req.body)) {
    return res.status(400).json({ error: 'Invalid input detected' });
  }

  if (req.query && checkObject(req.query)) {
    return res.status(400).json({ error: 'Invalid query parameters detected' });
  }

  if (req.params && checkObject(req.params)) {
    return res.status(400).json({ error: 'Invalid URL parameters detected' });
  }

  next();
};

// Input validation middleware
const validateInput = (req, res, next) => {
  // Email validation
  if (req.body.email && !validator.isEmail(req.body.email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Phone validation
  if (req.body.phone && !validator.isMobilePhone(req.body.phone, 'any')) {
    return res.status(400).json({ error: 'Invalid phone number format' });
  }

  // URL validation
  if (req.body.url && !validator.isURL(req.body.url)) {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  // Length validation for text fields
  const textFields = ['name', 'title', 'company', 'message', 'notes'];
  for (const field of textFields) {
    if (req.body[field] && req.body[field].length > 1000) {
      return res.status(400).json({ error: `${field} exceeds maximum length` });
    }
  }

  next();
};

// Request size limiting middleware
const requestSizeLimit = (req, res, next) => {
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (req.headers['content-length'] && parseInt(req.headers['content-length']) > maxSize) {
    return res.status(413).json({ error: 'Request entity too large' });
  }

  next();
};

// Security logging middleware
const securityLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log security-relevant events
  const logSecurityEvent = (event, details = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      method: req.method,
      url: req.originalUrl,
      userId: req.user?.id,
      ...details
    }));
  };

  // Override res.status to log failed requests
  const originalStatus = res.status;
  res.status = function(code) {
    if (code >= 400) {
      logSecurityEvent('FAILED_REQUEST', { statusCode: code });
    }
    return originalStatus.call(this, code);
  };

  // Log successful authentication
  if (req.originalUrl.includes('/auth/login') && req.method === 'POST') {
    const originalSend = res.send;
    res.send = function(body) {
      if (res.statusCode === 200) {
        logSecurityEvent('SUCCESSFUL_LOGIN');
      } else {
        logSecurityEvent('FAILED_LOGIN_ATTEMPT');
      }
      return originalSend.call(this, body);
    };
  }

  req.on('close', () => {
    const duration = Date.now() - startTime;
    if (duration > 10000) { // Log slow requests (>10s)
      logSecurityEvent('SLOW_REQUEST', { duration });
    }
  });

  next();
};

// CORS configuration - PRODUCTION SECURITY
const corsConfig = {
  origin: function (origin, callback) {
    // In production, only allow specific domains
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          'https://recruiting.northwesternmutual.com', // Replace with actual production domain
          process.env.FRONTEND_URL,
          process.env.CLIENT_URL
        ].filter(Boolean)
      : [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173',
          'http://localhost:5174',
          'http://localhost:5175',
          'http://localhost:8080',
          process.env.FRONTEND_URL,
          process.env.CLIENT_URL
        ].filter(Boolean);

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

module.exports = {
  generalLimiter,
  authLimiter,
  searchLimiter,
  helmetConfig,
  xssProtection,
  sqlInjectionProtection,
  validateInput,
  requestSizeLimit,
  securityLogger,
  corsConfig
};