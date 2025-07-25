import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { Question } from '../entities/Question';
import { Stage } from '../entities/Stage';
import { authMiddleware, AuthRequest, adminMiddleware } from '../middleware/auth';
import { openRouterService } from '../services/openRouterService';

const router = Router();

// Generate questions for a stage using AI
router.get('/generate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { stage, open = 5, closed = 5 } = req.query;
    const stageId = parseInt(stage as string);
    const openQuestions = parseInt(open as string);
    const closedQuestions = parseInt(closed as string);

    const stageRepository = AppDataSource.getRepository(Stage);
    const stageEntity = await stageRepository.findOne({ where: { id: stageId } });

    if (!stageEntity) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    // Generate questions using AI
    const aiResponse = await openRouterService.getInstance().generateQuestions(
      stageEntity.title,
      stageEntity.difficulty,
      openQuestions,
      closedQuestions
    );

    // Save generated questions to database
    const questionRepository = AppDataSource.getRepository(Question);
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

    // Update stage question count
    await stageRepository.update(stageId, {
      questionCount: savedQuestions.length
    });

    // Return questions without correct answers for security
    const questionsForClient = savedQuestions.map((q: any) => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      options: q.options,
      points: q.points,
      category: q.category,
      difficulty: q.difficulty
    }));

    res.json({ questions: questionsForClient });
  } catch (error) {
    console.error('Error generating questions:', error);
    res.status(500).json({ error: 'Failed to generate questions' });
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
