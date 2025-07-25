import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { Stage, ICreateStageInput } from '../entities/Stage';
import { UserStage } from '../entities/UserStage';
import { authMiddleware, AuthRequest, adminMiddleware } from '../middleware/auth';

const router = Router();

// Get all stages
router.get('/', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stageRepository = AppDataSource.getRepository(Stage);
    const userStageRepository = AppDataSource.getRepository(UserStage);

    const stages = await stageRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' }
    });

    // Get user progress for each stage
    const userStages = await userStageRepository.find({
      where: { userId: req.user!.id }
    });

    const stagesWithProgress = stages.map(stage => {
      const userStage = userStages.find(us => us.stageId === stage.id);
      return {
        ...stage,
        isCompleted: userStage?.isCompleted || false,
        userScore: userStage?.score || null,
        completedAt: userStage?.completedAt || null
      };
    });

    res.json({ stages: stagesWithProgress });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stages' });
  }
});

// Get stage details
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stageId = parseInt(req.params.id);
    const stageRepository = AppDataSource.getRepository(Stage);
    const userStageRepository = AppDataSource.getRepository(UserStage);

    const stage = await stageRepository.findOne({
      where: { id: stageId, isActive: true }
    });

    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const userStage = await userStageRepository.findOne({
      where: { userId: req.user!.id, stageId }
    });

    res.json({
      ...stage,
      isCompleted: userStage?.isCompleted || false,
      userScore: userStage?.score || null,
      completedAt: userStage?.completedAt || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stage details' });
  }
});

// Get user progress for a stage
router.get('/:id/progress', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stageId = parseInt(req.params.id);
    const userStageRepository = AppDataSource.getRepository(UserStage);

    const userStage = await userStageRepository.findOne({
      where: { userId: req.user!.id, stageId },
      relations: ['stage']
    });

    if (!userStage) {
      return res.json({
        stageId,
        isCompleted: false,
        score: null,
        completedAt: null
      });
    }

    res.json({
      stageId: userStage.stageId,
      stageTitle: userStage.stage.title,
      isCompleted: userStage.isCompleted,
      score: userStage.score,
      completedAt: userStage.completedAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stage progress' });
  }
});

// Create a new stage (Admin only)
router.post('/', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const {
      title,
      description,
      difficulty,
      icon,
      color,
      estimatedTime,
      displayOrder,
      isActive = true
    } = req.body;

    // Validate required fields
    if (!title || !description || !difficulty || !icon || !color || !estimatedTime || displayOrder === undefined) {
      return res.status(400).json({ 
        error: 'Missing required fields. Required: title, description, difficulty, icon, color, estimatedTime, displayOrder' 
      });
    }

    // Validate difficulty
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    if (!validDifficulties.includes(difficulty)) {
      return res.status(400).json({ 
        error: 'Invalid difficulty. Must be one of: beginner, intermediate, advanced' 
      });
    }

    // Create stage data object
    const stageData: ICreateStageInput = {
      title,
      description,
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
      icon,
      color,
      estimatedTime,
      displayOrder: parseInt(displayOrder),
      isActive: Boolean(isActive)
    };

    // Create the stage using the static method
    const newStage = await Stage.createStage(stageData);

    // Return the created stage without sensitive data
    const { id, questionCount } = newStage;
    
    res.status(201).json({
      message: 'Stage created successfully',
      stage: {
        id,
        title: newStage.title,
        description: newStage.description,
        difficulty: newStage.difficulty,
        icon: newStage.icon,
        color: newStage.color,
        estimatedTime: newStage.estimatedTime,
        questionCount,
        isActive: newStage.isActive,
        displayOrder: newStage.displayOrder
      }
    });
  } catch (error: unknown) {
    console.error('Error creating stage:', error);
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return res.status(409).json({ error: error.message });
      }
      return res.status(500).json({ error: 'Failed to create stage', details: error.message });
    }
    res.status(500).json({ error: 'An unknown error occurred while creating the stage' });
  }
});

export default router;
