const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    
    // Default error
    let status = err.status || 500;
    let message = err.message || 'Internal server error';
    
    // Specific error handling
    if (err.name === 'ValidationError') {
        status = 400;
        message = 'Validation failed';
    }
    
    if (err.name === 'UnauthorizedError') {
        status = 401;
        message = 'Unauthorized';
    }
    
    res.status(status).json({
        error: message,
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

module.exports = errorHandler;
