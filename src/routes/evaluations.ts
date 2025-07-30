import { Router } from 'express';
import { AppDataSource } from '../config/database-minimal';
import { Question } from '../entities/Question';
import { Stage } from '../entities/Stage';
import { authMiddleware, AuthRequest, adminMiddleware } from '../middleware/auth';
import { openRouterService } from '../services/openRouterService';

const router = Router();

// Cache para preguntas generadas (evita regenerar las mismas preguntas)
const questionGenerationCache = new Map<string, any>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutos

// Helper function para generar cache key
const generateCacheKey = (stageId: number, openQuestions: number, closedQuestions: number): string => {
  return `${stageId}-${openQuestions}-${closedQuestions}`;
};

// Helper function para validar parámetros
const validateGenerationParams = (stageId: number, openQuestions: number, closedQuestions: number): string | null => {
  if (!stageId || stageId <= 0) {
    return 'ID de etapa inválido';
  }
  if (openQuestions < 0 || closedQuestions < 0) {
    return 'El número de preguntas no puede ser negativo';
  }
  if (openQuestions + closedQuestions === 0) {
    return 'Debe especificar al menos una pregunta';
  }
  if (openQuestions + closedQuestions > 20) {
    return 'No puede generar más de 20 preguntas a la vez';
  }
  return null;
};

// Generate questions for a stage using AI
router.get('/generate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { stage, open = 5, closed = 5 } = req.query;
    const stageId = parseInt(stage as string);
    const openQuestions = parseInt(open as string);
    const closedQuestions = parseInt(closed as string);

    // Validar parámetros
    const validationError = validateGenerationParams(stageId, openQuestions, closedQuestions);
    if (validationError) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos',
        message: validationError
      });
    }

    // Verificar cache primero
    const cacheKey = generateCacheKey(stageId, openQuestions, closedQuestions);
    const cachedResult = questionGenerationCache.get(cacheKey);
    
    if (cachedResult && Date.now() - cachedResult.timestamp < CACHE_TTL) {
      console.log(`✅ Preguntas servidas desde cache para stage ${stageId}`);
      return res.json({ 
        questions: cachedResult.questions,
        fromCache: true
      });
    }

    // Buscar preguntas pre-generadas para este stage
    const questionRepository = AppDataSource.getRepository(Question);
    const existingQuestions = await questionRepository.find({
      where: { stageId },
      order: { id: 'ASC' }
    });

    if (existingQuestions.length === 0) {
      return res.status(404).json({ 
        error: 'No hay preguntas disponibles',
        message: 'Este stage no tiene preguntas generadas. Contacta al administrador para que genere las preguntas.'
      });
    }

    // Filtrar preguntas según el tipo solicitado
    const openTypeQuestions = existingQuestions.filter(q => q.type === 'open_text' || q.type === 'open-text');
    const closedTypeQuestions = existingQuestions.filter(q => q.type === 'multiple_choice' || q.type === 'multiple-choice');

    // Seleccionar el número de preguntas solicitado
    const selectedOpenQuestions = openTypeQuestions.slice(0, openQuestions);
    const selectedClosedQuestions = closedTypeQuestions.slice(0, closedQuestions);

    // Combinar y mezclar las preguntas
    const allSelectedQuestions = [...selectedOpenQuestions, ...selectedClosedQuestions];
    
    // Mezclar aleatoriamente las preguntas
    const shuffledQuestions = allSelectedQuestions.sort(() => Math.random() - 0.5);

    if (shuffledQuestions.length === 0) {
      return res.status(404).json({ 
        error: 'No hay suficientes preguntas',
        message: 'No hay suficientes preguntas del tipo solicitado para este stage.'
      });
    }

    console.log(`✅ ${shuffledQuestions.length} preguntas pre-generadas cargadas para stage ${stageId}`);

    // Formatear preguntas para el cliente (sin respuestas correctas)
    const questionsForClient = shuffledQuestions.map((q: any) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      options: q.options,
      points: q.points,
      category: q.category,
      difficulty: q.difficulty
    }));

    // Guardar en cache
    questionGenerationCache.set(cacheKey, {
      questions: questionsForClient,
      timestamp: Date.now()
    });

    res.json({ 
      questions: questionsForClient,
      fromPreGenerated: true,
      totalAvailable: existingQuestions.length,
      message: 'Preguntas pre-generadas cargadas exitosamente'
    });

  } catch (error: any) {
    console.error('Error loading pre-generated questions:', error);
    
    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'Error al cargar las preguntas. Por favor, intenta de nuevo más tarde.'
    });
  }
});

// Función de fallback para generar preguntas básicas cuando la IA falla
async function generateFallbackQuestions(
  stageEntity: any,
  openQuestions: number,
  closedQuestions: number,
  questionRepository: any,
  stageId: number
): Promise<any[]> {
  try {
    // Buscar preguntas existentes para este stage
    const existingQuestions = await questionRepository.find({
      where: { stageId },
      order: { id: 'DESC' },
      take: 20
    });

    if (existingQuestions.length >= (openQuestions + closedQuestions)) {
      return existingQuestions.slice(0, openQuestions + closedQuestions).map((q: any) => ({
        id: q.id,
        type: q.type,
        questionText: q.questionText,
        options: q.options,
        points: q.points,
        category: q.category,
        difficulty: q.difficulty
      }));
    }

    // Si no hay suficientes preguntas existentes, generar preguntas básicas
    const fallbackQuestions = [];
    
    // Generar preguntas abiertas básicas
    for (let i = 0; i < openQuestions; i++) {
      fallbackQuestions.push({
        id: `fallback_open_${stageId}_${i}`,
        type: 'open_text',
        questionText: `¿Cuáles son los aspectos más importantes de ${stageEntity.title}?`,
        options: null,
        points: 5,
        category: 'General',
        difficulty: stageEntity.difficulty
      });
    }

    // Generar preguntas cerradas básicas
    for (let i = 0; i < closedQuestions; i++) {
      fallbackQuestions.push({
        id: `fallback_closed_${stageId}_${i}`,
        type: 'multiple_choice',
        questionText: `¿Cuál de las siguientes opciones es correcta sobre ${stageEntity.title}?`,
        options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
        points: 3,
        category: 'General',
        difficulty: stageEntity.difficulty
      });
    }

    return fallbackQuestions;
  } catch (error) {
    console.error('Error generating fallback questions:', error);
    return [];
  }
}

// Regenerate questions for a stage (Admin only)
router.post('/regenerate/:stageId', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const stageId = parseInt(req.params.stageId);
    const { open = 5, closed = 5 } = req.body;

    // Validar parámetros
    const validationError = validateGenerationParams(stageId, open, closed);
    if (validationError) {
      return res.status(400).json({ 
        error: 'Parámetros inválidos',
        message: validationError
      });
    }

    // Obtener información del stage
    const stageRepository = AppDataSource.getRepository(Stage);
    const stageEntity = await stageRepository.findOne({ where: { id: stageId } });

    if (!stageEntity) {
      return res.status(404).json({ 
        error: 'Etapa no encontrada',
        message: 'La etapa especificada no existe'
      });
    }

    console.log(`🔄 Regenerando preguntas para stage: ${stageEntity.title}`);

    // Generar preguntas con IA
    const aiResponse = await openRouterService.getInstance().generateQuestions(
      stageEntity.title,
      stageEntity.difficulty,
      open,
      closed,
      stageEntity.considerations || undefined
    );

    // Eliminar preguntas existentes
    const questionRepository = AppDataSource.getRepository(Question);
    await questionRepository.delete({ stageId });

    // Guardar nuevas preguntas
    const questionsToSave = aiResponse.questions.map((q: any) => ({
      stageId,
      type: q.type,
      questionText: q.questionText,
      options: q.options || null,
      correctAnswer: q.correctAnswer || null,
      points: q.points,
      category: q.category,
      difficulty: q.difficulty
    }));

    const savedQuestions = await questionRepository.save(questionsToSave);

    // Actualizar conteo de preguntas del stage
    await stageRepository.update(stageId, {
      questionCount: savedQuestions.length
    });

    // Limpiar cache para este stage
    const cacheKeysToDelete = Array.from(questionGenerationCache.keys())
      .filter(key => key.startsWith(`${stageId}-`));
    cacheKeysToDelete.forEach(key => questionGenerationCache.delete(key));

    console.log(`✅ ${savedQuestions.length} preguntas regeneradas exitosamente para stage ${stageId}`);

    res.json({ 
      message: 'Preguntas regeneradas exitosamente',
      questionsCount: savedQuestions.length,
      stageId
    });

  } catch (error: any) {
    console.error('Error regenerating questions:', error);
    
    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return res.status(408).json({ 
        error: 'Timeout',
        message: 'La regeneración de preguntas está tomando más tiempo del esperado. Por favor, intenta de nuevo en unos momentos.'
      });
    }
    
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      return res.status(503).json({ 
        error: 'Servicio no disponible',
        message: 'El servicio de IA no está disponible en este momento. Por favor, intenta de nuevo más tarde.'
      });
    }

    res.status(500).json({ 
      error: 'Error interno del servidor',
      message: 'Error al regenerar preguntas. Por favor, intenta de nuevo más tarde.'
    });
  }
});

// Create a new question (admin only)
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const questionRepository = AppDataSource.getRepository(Question);
    const question = questionRepository.create(req.body);
    const savedQuestion = await questionRepository.save(question);

    res.status(201).json({ question: savedQuestion });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create question' });
  }
});

// Get question details (admin only)
router.get('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const questionId = parseInt(req.params.id);
    const questionRepository = AppDataSource.getRepository(Question);
    const question = await questionRepository.findOne({
      where: { id: questionId },
      relations: ['stage']
    });

    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    res.json({ question });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch question' });
  }
});

export default router;
