import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { SignOptions } from 'jsonwebtoken';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Helper function para crear tokens de forma segura
const createToken = (payload: object, secret: string, expiresIn: number): string => {
  const options: SignOptions = {
    expiresIn: expiresIn
  };
  return jwt.sign(payload, secret, options);
};

// Register
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const userRepository = AppDataSource.getRepository(User);
    
    // Check if user exists
    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = userRepository.create({
      email,
      passwordHash,
      firstName,
      lastName,
    });

    await userRepository.save(user);

    // Generate token
    const jwtSecret = process.env.JWT_SECRET;
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || 86400;
    
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const token = createToken(
      { userId: user.id }, 
      jwtSecret,
      jwtExpiresIn as number
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        globalScore: user.globalScore,
        currentStageId: user.currentStageId,
      },
    });
    console.log('User created successfully', user, token, res);
  } catch (error) {
    next(error);
  }
});

// Login
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || 86400;

    const token = createToken(
      { userId: user.id }, 
      process.env.JWT_SECRET!,
      jwtExpiresIn as number
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        globalScore: user.globalScore,
        currentStageId: user.currentStageId,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req: AuthRequest, res) => {
  try {
    const jwtSecret = process.env.JWT_SECRET;
    
    if (!jwtSecret) {
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || 86400;

    const token = createToken(
      { userId: req.user!.id }, 
      jwtSecret,
      jwtExpiresIn as number
    );

    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: 'Failed to refresh token' });
  }
});

// Logout (client-side only)
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout successful' });
});

export default router;
