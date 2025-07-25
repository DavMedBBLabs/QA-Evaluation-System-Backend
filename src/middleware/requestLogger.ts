import { Request, Response, NextFunction } from 'express';

// Helper function to get the current timestamp in a readable format
const getCurrentTime = () => {
  return new Date().toISOString();
};

// Middleware to log all incoming requests
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  // Skip logging for health checks and favicon.ico
  if (req.path === '/health' || req.path === '/favicon.ico') {
    return next();
  }

  const start = Date.now();
  const { method, originalUrl, ip } = req;
  
  // Log the incoming request
  console.log(`[${getCurrentTime()}] ${method} ${originalUrl} from ${ip}`);
  
  // Log request headers in development
  if (process.env.NODE_ENV === 'development') {
    console.log('Headers:', {
      'user-agent': req.headers['user-agent'],
      'content-type': req.headers['content-type'],
      authorization: req.headers.authorization ? '***' : 'none',
    });
  }

  // Log the response when it's finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(
      `[${getCurrentTime()}] ${method} ${originalUrl} - ${res.statusCode} ${res.statusMessage} (${duration}ms)`
    );
  });

  next();
};
