import * as path from 'path';
import * as dotenv from 'dotenv';

// Log current working directory
console.log('Current working directory:', process.cwd());

// Try to load .env file directly
const envPath = path.resolve(process.cwd(), '.env');
console.log('Loading .env from:', envPath);

const result = dotenv.config({ path: envPath });

if (result.error) {
  console.error('Error loading .env file:', result.error);
} else {
  console.log('Successfully loaded .env file');
}

// Log all environment variables that start with OPENROUTER_ or JWT_
console.log('\nEnvironment variables:');
Object.keys(process.env)
  .filter(key => key.startsWith('OPENROUTER_') || key.startsWith('JWT_'))
  .forEach(key => {
    console.log(`${key} = ${process.env[key] ? '***' + process.env[key]!.substring(process.env[key]!.length - 4) : 'undefined'}`);
  });

// Try to access the OpenRouter API key
console.log('\nTesting OpenRouter API key access:');
console.log('process.env.OPENROUTER_API_KEY exists:', !!process.env.OPENROUTER_API_KEY);
console.log('Type of OPENROUTER_API_KEY:', typeof process.env.OPENROUTER_API_KEY);

if (process.env.OPENROUTER_API_KEY) {
  console.log('OpenRouter API key length:', process.env.OPENROUTER_API_KEY.length);
  console.log('First 5 chars:', process.env.OPENROUTER_API_KEY.substring(0, 5) + '...');
}
