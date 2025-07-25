import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';

export interface AuthRequest extends Request {
  user?: User;
  token?: string;
}

// Token expiration times (in seconds)
const ACCESS_TOKEN_EXPIRY = 86400; // 1 day
const REFRESH_TOKEN_EXPIRY = 604800; // 7 days

// Helper function to verify token with proper typing
const verifyToken = (token: string, secret: string): any => {
  return jwt.verify(token, secret);
};

export const authMiddleware = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // Get token from Authorization header or cookies
    let token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token && req.cookies?.token) {
      token = req.cookies.token;
    }
    
    if (!token) {
      return res.status(401).json({ 
        error: 'No se encontró el token de autenticación. Por favor, inicia sesión nuevamente.',
        code: 'NO_TOKEN'
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: number };
      
      // Get user from database
      const userRepository = AppDataSource.getRepository(User);
      const user = await userRepository.findOne({ 
        where: { id: decoded.userId },
        select: ['id', 'email', 'firstName', 'lastName', 'role', 'globalScore', 'currentStageId']
      });

      if (!user) {
        return res.status(401).json({ 
          error: 'Usuario no encontrado. Por favor, inicia sesión nuevamente.',
          code: 'USER_NOT_FOUND'
        });
      }

      // Attach user and token to request
      req.user = user;
      req.token = token;
      next();
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return res.status(401).json({
          error: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
          code: 'TOKEN_EXPIRED'
        });
      }
      
      console.error('Error de autenticación:', error);
      return res.status(401).json({ 
        error: 'Token inválido. Por favor, inicia sesión nuevamente.',
        code: 'INVALID_TOKEN'
      });
    }
  } catch (error) {
    console.error('Error en el middleware de autenticación:', error);
    res.status(500).json({ 
      error: 'Error de autenticación. Por favor, inténtalo de nuevo más tarde.',
      code: 'AUTH_ERROR'
    });
  }
};

export const adminMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }
  next();
};