import { DataSource } from 'typeorm';
import { User } from '../entities/User';
import { Stage } from '../entities/Stage';
import { Question } from '../entities/Question';
import { UserStage } from '../entities/UserStage';
import { EvaluationAttempt } from '../entities/EvaluationAttempt';
import { UserResponse } from '../entities/UserResponse';
import { Feedback } from '../entities/Feedback';

// Parse the database URL to extract components
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// For Aiven PostgreSQL, we need to use SSL
const sslConfig = {
  rejectUnauthorized: false, // For development only, in production use proper certificates
};

// Create a new DataSource instance
const createDataSource = () => {
  try {
    const url = new URL(dbUrl);
    
    return new DataSource({
      type: 'postgres',
      url: dbUrl,
      ssl: sslConfig,
      synchronize: process.env.NODE_ENV === 'development',
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
      migrations: ['src/migrations/*.ts'],
      extra: {
        ssl: sslConfig
      }
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
    await AppDataSource.initialize();
  }
  return AppDataSource;
};
