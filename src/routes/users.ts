import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../entities/User';
import { UserStage } from '../entities/UserStage';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Get current user profile
router.get('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { id: req.user!.id },
      relations: ['userStages', 'userStages.stage']
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const completedStages = user.userStages
      .filter(us => us.isCompleted)
      .map(us => us.stageId);

    res.json({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      globalScore: user.globalScore,
      currentStageId: user.currentStageId,
      completedStages,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// Update user profile
router.put('/me', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { firstName, lastName } = req.body;
    const userRepository = AppDataSource.getRepository(User);

    await userRepository.update(req.user!.id, {
      firstName: firstName || req.user!.firstName,
      lastName: lastName || req.user!.lastName,
    });

    const updatedUser = await userRepository.findOne({
      where: { id: req.user!.id }
    });

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: updatedUser!.id,
        email: updatedUser!.email,
        firstName: updatedUser!.firstName,
        lastName: updatedUser!.lastName,
        role: updatedUser!.role,
        globalScore: updatedUser!.globalScore,
        currentStageId: updatedUser!.currentStageId,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Get user progress
router.get('/progress', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userStageRepository = AppDataSource.getRepository(UserStage);
    const userStages = await userStageRepository.find({
      where: { userId: req.user!.id },
      relations: ['stage']
    });

    const progress = userStages.map(us => ({
      stageId: us.stageId,
      stageTitle: us.stage.title,
      isCompleted: us.isCompleted,
      score: us.score,
      completedAt: us.completedAt
    }));

    res.json({ progress });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user progress' });
  }
});

export default router;
