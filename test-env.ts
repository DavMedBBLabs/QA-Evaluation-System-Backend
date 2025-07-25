import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('Environment variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
console.log('JWT_SECRET exists:', !!process.env.JWT_SECRET);

// Try to create OpenRouterService
import { openRouterService } from './src/services/openRouterService';

try {
  const service = openRouterService.getInstance();
  console.log('OpenRouterService created successfully!');
} catch (error) {
  console.error('Error creating OpenRouterService:', error.message);
}
