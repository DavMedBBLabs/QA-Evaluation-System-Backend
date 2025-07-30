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
  const { method, originalUrl } = req;
  

  // Log the response when it's finished (only in development)
  if (process.env.NODE_ENV === 'development') {
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(
        `[${getCurrentTime()}] ${method} ${originalUrl} - ${res.statusCode} ${res.statusMessage} (${duration}ms)`
      );
    });
  }

  next();
};
