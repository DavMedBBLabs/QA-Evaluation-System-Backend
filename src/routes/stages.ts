import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { Stage, ICreateStageInput } from '../entities/Stage';
import { UserStage } from '../entities/UserStage';
import { authMiddleware, AuthRequest, adminMiddleware } from '../middleware/auth';
import { openRouterService } from '../services/openRouterService';

const router = Router();

// Helper function to determine if a stage is unlocked
const isStageUnlocked = (stage: any, stages: any[], userStages: any[]): boolean => {
  // Si es el primer stage por displayOrder, siempre está desbloqueado
  if (stage.displayOrder === 1) {
    console.log(`Stage ${stage.id} (displayOrder: ${stage.displayOrder}): First stage, always unlocked`);
    return true;
  }
  
  // Para otros stages, verificar si el stage anterior está completado
  const previousStage = stages.find(s => s.displayOrder === stage.displayOrder - 1);
  if (!previousStage) {
    // Si no hay stage anterior, está desbloqueado
    // Esto puede pasar si hay gaps en el displayOrder
    console.warn(`Stage ${stage.id} (displayOrder: ${stage.displayOrder}) has no previous stage. Unlocking by default.`);
    return true;
  }
  
  const previousUserStage = userStages.find(us => us.stageId === previousStage.id);
  const isUnlocked = previousUserStage?.isCompleted || false;
  
  // Log para debugging
  console.log(`Stage ${stage.id} (displayOrder: ${stage.displayOrder}): previous stage ${previousStage.id} (displayOrder: ${previousStage.displayOrder}) completed: ${previousUserStage?.isCompleted}, unlocked: ${isUnlocked}`);
  
  return isUnlocked;
};

// Validation function to ensure proper stage unlocking logic
const validateStageUnlocking = (stages: any[], userStages: any[]): void => {
  console.log('=== STAGE UNLOCKING VALIDATION ===');
  console.log(`Total stages: ${stages.length}`);
  console.log(`User completed stages: ${userStages.filter(us => us.isCompleted).map(us => us.stageId).join(', ')}`);
  
  stages.forEach(stage => {
    const isUnlocked = isStageUnlocked(stage, stages, userStages);
    console.log(`Stage ${stage.id} (${stage.title}) - displayOrder: ${stage.displayOrder}, unlocked: ${isUnlocked}`);
  });
  console.log('=== END VALIDATION ===');
};

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

    // Validate stage unlocking logic
    validateStageUnlocking(stages, userStages);

    const stagesWithProgress = stages.map(stage => {
      const userStage = userStages.find(us => us.stageId === stage.id);
      
      // Determinar si el stage está desbloqueado usando la función helper
      const isUnlocked = isStageUnlocked(stage, stages, userStages);
      
      return {
        id: stage.id,
        title: stage.title,
        description: stage.description,
        difficulty: stage.difficulty,
        icon: stage.icon,
        color: stage.color,
        estimatedTime: stage.estimatedTime,
        questionCount: stage.questionCount,
        isActive: stage.isActive,
        displayOrder: stage.displayOrder,
        considerations: stage.considerations,
        topicsCovered: stage.topicsCovered,
        whatToExpect: stage.whatToExpect,
        tipsForSuccess: stage.tipsForSuccess,
        evaluationDescription: stage.evaluationDescription,
        totalQuestions: stage.totalQuestions,
        openQuestions: stage.openQuestions,
        closedQuestions: stage.closedQuestions,
        isCompleted: userStage?.isCompleted || false,
        userScore: userStage?.score || null,
        completedAt: userStage?.completedAt || null,
        isUnlocked
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
      totalQuestions: stage.totalQuestions,
      openQuestions: stage.openQuestions,
      closedQuestions: stage.closedQuestions,
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
      isActive = true,
      considerations = null
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

    // Generate stage details using AI
    const stageDetails = await openRouterService.getInstance().generateStageDetails(
      title,
      description,
      difficulty,
      considerations
    );

    // Create stage data object with AI-generated details
    const stageData: ICreateStageInput = {
      title,
      description,
      difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
      icon,
      color,
      estimatedTime,
      displayOrder: parseInt(displayOrder),
      isActive: Boolean(isActive),
      considerations,
      topicsCovered: stageDetails.topicsCovered,
      whatToExpect: stageDetails.whatToExpect,
      tipsForSuccess: stageDetails.tipsForSuccess,
      evaluationDescription: stageDetails.evaluationDescription
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
        displayOrder: newStage.displayOrder,
        considerations: newStage.considerations,
        topicsCovered: newStage.topicsCovered,
        whatToExpect: newStage.whatToExpect,
        tipsForSuccess: newStage.tipsForSuccess,
        evaluationDescription: newStage.evaluationDescription
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

// Edit a stage (Admin only)
router.patch('/:id', authMiddleware, adminMiddleware, async (req: AuthRequest, res) => {
  try {
    const stageId = parseInt(req.params.id);
    const stageRepository = AppDataSource.getRepository(Stage);

    const stage = await stageRepository.findOne({ where: { id: stageId } });
    if (!stage) {
      return res.status(404).json({ error: 'Stage not found' });
    }

    const {
      title,
      description,
      difficulty,
      icon,
      color,
      estimatedTime,
      displayOrder,
      isActive,
      considerations,
      totalQuestions,
      openQuestions,
      closedQuestions
    } = req.body;

    // Si se va a cambiar el displayOrder, validar unicidad
    if (displayOrder !== undefined && displayOrder !== stage.displayOrder) {
      const existing = await stageRepository.findOne({ where: { displayOrder: parseInt(displayOrder) } });
      if (existing && existing.id !== stageId) {
        return res.status(409).json({ error: 'Another stage with this displayOrder already exists' });
      }
      stage.displayOrder = parseInt(displayOrder);
    }
    if (title !== undefined) stage.title = title;
    if (description !== undefined) stage.description = description;
    if (difficulty !== undefined) stage.difficulty = difficulty;
    if (icon !== undefined) stage.icon = icon;
    if (color !== undefined) stage.color = color;
    if (estimatedTime !== undefined) stage.estimatedTime = estimatedTime;
    if (isActive !== undefined) stage.isActive = Boolean(isActive);
    if (considerations !== undefined) stage.considerations = considerations;
    if (totalQuestions !== undefined) stage.totalQuestions = parseInt(totalQuestions);
    if (openQuestions !== undefined) stage.openQuestions = parseInt(openQuestions);
    if (closedQuestions !== undefined) stage.closedQuestions = parseInt(closedQuestions);

    await stageRepository.save(stage);

    res.json({
      message: 'Stage updated successfully',
      stage: {
        id: stage.id,
        title: stage.title,
        description: stage.description,
        difficulty: stage.difficulty,
        icon: stage.icon,
        color: stage.color,
        estimatedTime: stage.estimatedTime,
        displayOrder: stage.displayOrder,
        isActive: stage.isActive,
        considerations: stage.considerations,
        totalQuestions: stage.totalQuestions,
        openQuestions: stage.openQuestions,
        closedQuestions: stage.closedQuestions
      }
    });
  } catch (error) {
    console.error('Error updating stage:', error);
    res.status(500).json({ error: 'Failed to update stage', details: error instanceof Error ? error.message : error });
  }
});

// Debug endpoint to validate stage unlocking logic
router.get('/debug/unlocking', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stageRepository = AppDataSource.getRepository(Stage);
    const userStageRepository = AppDataSource.getRepository(UserStage);

    const stages = await stageRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' }
    });

    const userStages = await userStageRepository.find({
      where: { userId: req.user!.id }
    });

    const debugInfo = stages.map(stage => {
      const userStage = userStages.find(us => us.stageId === stage.id);
      const isUnlocked = isStageUnlocked(stage, stages, userStages);
      
      return {
        id: stage.id,
        title: stage.title,
        displayOrder: stage.displayOrder,
        isCompleted: userStage?.isCompleted || false,
        isUnlocked,
        userScore: userStage?.score || null,
        completedAt: userStage?.completedAt || null,
        userStageData: userStage ? {
          stageId: userStage.stageId,
          isCompleted: userStage.isCompleted,
          score: userStage.score,
          completedAt: userStage.completedAt
        } : null
      };
    });

    res.json({
      userId: req.user!.id,
      totalStages: stages.length,
      completedStages: userStages.filter(us => us.isCompleted).map(us => us.stageId),
      allUserStages: userStages.map(us => ({
        stageId: us.stageId,
        isCompleted: us.isCompleted,
        score: us.score,
        completedAt: us.completedAt
      })),
      stages: debugInfo
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch debug info' });
  }
});

// Temporary debug endpoint for stage 16
router.get('/debug/stage16', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stageRepository = AppDataSource.getRepository(Stage);
    const userStageRepository = AppDataSource.getRepository(UserStage);

    const stage16 = await stageRepository.findOne({
      where: { id: 16 }
    });

    const userStage16 = await userStageRepository.findOne({
      where: { userId: req.user!.id, stageId: 16 }
    });

    res.json({
      stage: stage16,
      userStage: userStage16,
      userId: req.user!.id,
      isCompleted: userStage16?.isCompleted || false,
      score: userStage16?.score || null,
      completedAt: userStage16?.completedAt || null
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stage 16 debug info' });
  }
});

export default router;
