-- Initialize QA Platform Database
-- This script runs when the PostgreSQL container starts for the first time

-- Create the database if it doesn't exist
SELECT 'CREATE DATABASE qa_platform'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'qa_platform')\gexec

-- Connect to the qa_platform database
\c qa_platform;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create initial tables (these will be managed by TypeORM migrations)
-- The actual table creation will be handled by the backend application

-- Create a function to check if tables exist
CREATE OR REPLACE FUNCTION table_exists(table_name text) 
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = $1
    );
END;
$$ LANGUAGE plpgsql;

-- Log initialization
DO $$
BEGIN
    RAISE NOTICE 'QA Platform database initialized successfully';
END $$; 