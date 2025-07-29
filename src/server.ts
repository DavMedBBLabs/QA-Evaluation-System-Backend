// Load environment variables first
import dotenv from 'dotenv';
dotenv.config({ path: process.env.NODE_ENV === 'production' ? undefined : '.env' });

import 'reflect-metadata';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppDataSource, getDataSource } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import stageRoutes from './routes/stages';
import questionRoutes from './routes/questions';
import evaluationRoutes from './routes/evaluations';
import feedbackRoutes from './routes/feedback';
import skillsRoutes from './routes/skills';

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit cada IP a 100 requests por windowMs
    message: 'Too many requests, please try again later.',
});

// Middleware
app.use(helmet());
app.use(limiter);
app.use(requestLogger);
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stages', stageRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/skills', skillsRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

// Initialize database connection and start server
const startServer = async () => {
  try {
    // Initialize database connection
    const dataSource = await getDataSource();
    console.log('Database connected successfully');

    // Run migrations in development
    if (process.env.NODE_ENV === 'development') {
      await dataSource.runMigrations();
      console.log('Migrations run successfully');
    }

    // Start the server
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`CORS Origin: ${process.env.CORS_ORIGIN || 'http://localhost:8080'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  process.exit(1);
});

// Start the application
startServer();
