-- =====================================================
-- QA Evaluation System Database Initialization Script
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USERS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(255) NOT NULL,
    last_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) DEFAULT 'user',
    global_score INTEGER DEFAULT 0,
    current_stage_id INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =====================================================
-- STAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS stages (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    difficulty VARCHAR(50) NOT NULL,
    icon VARCHAR(255),
    color VARCHAR(50),
    estimated_time VARCHAR(100),
    question_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER NOT NULL,
    considerations TEXT,
    topics_covered TEXT[],
    what_to_expect TEXT,
    tips_for_success TEXT[],
    evaluation_description TEXT,
    total_questions INTEGER DEFAULT 10,
    open_questions INTEGER DEFAULT 5,
    closed_questions INTEGER DEFAULT 5
);

-- =====================================================
-- QUESTIONS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    stage_id INTEGER NOT NULL,
    type VARCHAR(50) NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer VARCHAR(255),
    points INTEGER DEFAULT 1,
    category VARCHAR(100),
    difficulty VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
);

-- =====================================================
-- USER_STAGES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_stages (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stage_id INTEGER NOT NULL,
    is_completed BOOLEAN DEFAULT false,
    score INTEGER,
    completed_at TIMESTAMP,
    UNIQUE(user_id, stage_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
);

-- =====================================================
-- EVALUATION_ATTEMPTS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS evaluation_attempts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    stage_id INTEGER NOT NULL,
    attempt_id VARCHAR(255) UNIQUE NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    time_spent_seconds INTEGER,
    score INTEGER,
    is_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
);

-- =====================================================
-- USER_RESPONSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS user_responses (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    response TEXT NOT NULL,
    is_correct BOOLEAN,
    points_earned INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES evaluation_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES questions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =====================================================
-- FEEDBACK TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS feedback (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    stage_id INTEGER NOT NULL,
    score INTEGER NOT NULL,
    total_questions INTEGER NOT NULL,
    correct_answers INTEGER NOT NULL,
    strengths TEXT[] NOT NULL,
    improvements TEXT[] NOT NULL,
    next_steps TEXT NOT NULL,
    detailed_feedback TEXT NOT NULL,
    badge VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (attempt_id) REFERENCES evaluation_attempts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (stage_id) REFERENCES stages(id) ON DELETE CASCADE
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_stages_display_order ON stages(display_order);
CREATE INDEX IF NOT EXISTS idx_stages_is_active ON stages(is_active);
CREATE INDEX IF NOT EXISTS idx_questions_stage_id ON questions(stage_id);
CREATE INDEX IF NOT EXISTS idx_user_stages_user_id ON user_stages(user_id);
CREATE INDEX IF NOT EXISTS idx_user_stages_stage_id ON user_stages(stage_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_user_id ON evaluation_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_stage_id ON evaluation_attempts(stage_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_attempt_id ON user_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_question_id ON user_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_feedback_attempt_id ON feedback(attempt_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);

-- =====================================================
-- COMMIT TRANSACTION
-- =====================================================
COMMIT; 