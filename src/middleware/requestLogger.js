/**
 * Request Logger Middleware
 * Logs all incoming requests for audit trail
 */

const requestLogger = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const { method, originalUrl, ip } = req;
  
  console.log(`[${timestamp}] ${method} ${originalUrl} - IP: ${ip}`);
  
  // Log request body for POST/PUT/PATCH requests (excluding sensitive data)
  if (['POST', 'PUT', 'PATCH'].includes(method)) {
    const sanitizedBody = { ...req.body };
    // Remove any sensitive fields if they exist
    delete sanitizedBody.password;
    delete sanitizedBody.token;
    
    console.log('Request Body:', JSON.stringify(sanitizedBody, null, 2));
  }
  
  next();
};

module.exports = requestLogger;
