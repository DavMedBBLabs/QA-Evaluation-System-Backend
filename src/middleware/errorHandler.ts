import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
  error: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('Error:', error);

  // Errores de validación
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Validation Error',
      details: error.details
    });
  }

  // Errores de base de datos PostgreSQL
  if (error.code === '23505') { // PostgreSQL unique violation
    return res.status(400).json({
      error: 'Resource already exists'
    });
  }

  // Errores de conexión a base de datos
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Database connection error. Please try again in a moment.',
      retryAfter: 30
    });
  }

  // Errores de timeout
  if (error.code === 'ETIMEDOUT' || error.message?.includes('timeout')) {
    return res.status(408).json({
      error: 'Request timeout',
      message: 'The request took too long to complete. Please try again.',
      retryAfter: 10
    });
  }

  // Errores de JWT
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: 'Invalid token'
    });
  }

  // Errores de JWT expirado
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Token expired',
      message: 'Your session has expired. Please log in again.'
    });
  }

  // Errores de red
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNRESET') {
    return res.status(503).json({
      error: 'Network error',
      message: 'Unable to connect to the service. Please check your connection and try again.',
      retryAfter: 15
    });
  }

  // Error por defecto
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
};
