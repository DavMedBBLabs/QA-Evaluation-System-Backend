import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Stage } from '../entities/Stage';
import { Question } from '../entities/Question';
import { UserStage } from '../entities/UserStage';
import { EvaluationAttempt } from '../entities/EvaluationAttempt';
import { UserResponse } from '../entities/UserResponse';
import { Feedback } from '../entities/Feedback';
import dotenv from 'dotenv';

dotenv.config();

// Parse the database URL to extract components
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Determine if SSL should be used based on the database URL
const shouldUseSSL = dbUrl.includes('aiven') || dbUrl.includes('cloud') || process.env.FORCE_SSL === 'true';

// SSL configuration for cloud databases
const sslConfig = shouldUseSSL ? {
  rejectUnauthorized: false, // For development only, in production use proper certificates
} : false;

// Create a new DataSource instance with all necessary entities
const createDataSource = () => {
  try {
    return new DataSource({
      type: 'postgres',
      url: dbUrl,
      ssl: sslConfig,
      synchronize: false, // Disable synchronize for safety
      logging: false, // Disable all database query logging
      entities: [
        User, 
        Stage,
        Question,
        UserStage,
        EvaluationAttempt,
        UserResponse,
        Feedback
      ],
      extra: shouldUseSSL ? {
        ssl: sslConfig
      } : {}
    });
  } catch (error) {
    console.error('Error creating database connection:', error);
    throw error;
  }
};

// Create and export the data source instance
export const AppDataSource = createDataSource();

// Function to get a connected data source
export const getDataSource = async () => {
  if (!AppDataSource.isInitialized) {
    try {
      await AppDataSource.initialize();
      console.log('✅ Database connection established');
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }
  return AppDataSource;
}; 