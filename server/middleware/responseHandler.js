const responseHandler = (req, res, next) => {
  res.successResponse = (data, message = 'Success') => {
    res.json({
      success: true,
      message,
      data,
      timestamp: new Date().toISOString(),
    });
  };

  res.errorResponse = (error, statusCode = 500) => {
    res.status(statusCode).json({
      success: false,
      message: error.message || 'An error occurred',
      error: process.env.NODE_ENV === 'development' ? error : undefined,
      timestamp: new Date().toISOString(),
    });
  };

  next();
};

module.exports = responseHandler;
