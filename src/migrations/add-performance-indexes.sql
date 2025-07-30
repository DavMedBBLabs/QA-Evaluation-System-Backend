-- Script para agregar índices de rendimiento para optimizar las consultas de analytics
-- Ejecutar este script en la base de datos para mejorar significativamente el rendimiento

-- Índices para la tabla evaluation_attempts
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_user_id ON evaluation_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_stage_id ON evaluation_attempts(stage_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_created_at ON evaluation_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_user_stage ON evaluation_attempts(user_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_user_created ON evaluation_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_stage_created ON evaluation_attempts(stage_id, created_at);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_score ON evaluation_attempts(score);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_is_completed ON evaluation_attempts(is_completed);

-- Índices compuestos para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_user_stage_created ON evaluation_attempts(user_id, stage_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evaluation_attempts_user_completed_score ON evaluation_attempts(user_id, is_completed, score);

-- Índices para la tabla stages
CREATE INDEX IF NOT EXISTS idx_stages_is_active ON stages(is_active);
CREATE INDEX IF NOT EXISTS idx_stages_display_order ON stages(display_order);

-- Índices para la tabla users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Índices para la tabla questions
CREATE INDEX IF NOT EXISTS idx_questions_stage_id ON questions(stage_id);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(type);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);

-- Índices para la tabla user_responses
CREATE INDEX IF NOT EXISTS idx_user_responses_attempt_id ON user_responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_user_id ON user_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_user_responses_question_id ON user_responses(question_id);

-- Índices para la tabla feedback
CREATE INDEX IF NOT EXISTS idx_feedback_attempt_id ON feedback(attempt_id);
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_stage_id ON feedback(stage_id);

-- Análisis de estadísticas para optimizar el planificador de consultas
ANALYZE evaluation_attempts;
ANALYZE stages;
ANALYZE users;
ANALYZE questions;
ANALYZE user_responses;
ANALYZE feedback;

-- Comentarios sobre los índices:
-- 1. idx_evaluation_attempts_user_id: Optimiza consultas por usuario
-- 2. idx_evaluation_attempts_stage_id: Optimiza consultas por stage
-- 3. idx_evaluation_attempts_created_at: Optimiza filtros por fecha
-- 4. idx_evaluation_attempts_user_stage: Optimiza consultas que filtran por usuario y stage
-- 5. idx_evaluation_attempts_user_created: Optimiza consultas que filtran por usuario y fecha
-- 6. idx_evaluation_attempts_stage_created: Optimiza consultas que filtran por stage y fecha
-- 7. idx_evaluation_attempts_score: Optimiza cálculos de puntuación
-- 8. idx_evaluation_attempts_is_completed: Optimiza filtros por estado de completado
-- 9. idx_evaluation_attempts_user_stage_created: Índice compuesto para consultas complejas
-- 10. idx_evaluation_attempts_user_completed_score: Optimiza métricas de rendimiento

-- Estos índices mejorarán significativamente el rendimiento de:
-- - Consultas de analytics por usuario
-- - Filtros por tiempo
-- - Cálculos de métricas
-- - Ordenamiento por fecha
-- - Consultas de feedback