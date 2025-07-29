import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { Feedback } from '../entities/Feedback';
import { EvaluationAttempt } from '../entities/EvaluationAttempt';
import { UserResponse } from '../entities/UserResponse';
import { Question } from '../entities/Question';
import { Stage } from '../entities/Stage';
import { UserStage } from '../entities/UserStage';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { openRouterService } from '../services/openRouterService';
import { User } from '../entities/User';

const router = Router();

// Submit evaluation attempt and generate feedback
router.post('/attempts', authMiddleware, async (req: AuthRequest, res) => {
  const queryRunner = AppDataSource.createQueryRunner();
  
  try {
    const { attemptId, userId, stageId, responses, timeSpent } = req.body;
    
    // Validate required fields
    if (!req.user?.id) {
      return res.status(401).json({ success: false, error: 'User not authenticated' });
    }
    
    // Ensure userId from payload matches authenticated user
    if (Number(userId) !== req.user.id) {
      return res.status(403).json({ success: false, error: 'User ID mismatch' });
    }

    console.log('Request body:', { attemptId, userId, stageId, responses, timeSpent });
    console.log('User ID from payload:', userId);
    console.log('User ID from token:', req.user.id);
    console.log('Type of user ID:', typeof userId);
    console.log('Stage ID from payload:', stageId);
    console.log('Type of stage ID:', typeof stageId);
    
    // Validate that userId and stageId are valid numbers
    if (!userId || isNaN(Number(userId)) || Number(userId) <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid user ID' });
    }
    
    if (!stageId || isNaN(Number(stageId)) || Number(stageId) <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid stage ID' });
    }

    // Start transaction
    await queryRunner.connect();
    await queryRunner.startTransaction();

    // Get repositories
    const attemptRepository = queryRunner.manager.getRepository(EvaluationAttempt);
    const feedbackRepository = queryRunner.manager.getRepository(Feedback);
    const responseRepository = queryRunner.manager.getRepository(UserResponse);
    const questionRepository = queryRunner.manager.getRepository(Question);
    const stageRepository = queryRunner.manager.getRepository(Stage);
    const userRepository = queryRunner.manager.getRepository(User);

    // Verify user exists
    const user = await userRepository.findOne({ where: { id: Number(userId) } });
    if (!user) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Verify stage exists
    const stage = await stageRepository.findOne({ where: { id: Number(stageId) } });
    if (!stage) {
      await queryRunner.rollbackTransaction();
      return res.status(404).json({ success: false, error: 'Stage not found' });
    }

    // Check if stage has questions first
    const stageQuestions = await questionRepository.find({ where: { stageId } });
    console.log(`Stage ${stageId} has ${stageQuestions.length} questions available`);
    
    if (stageQuestions.length === 0) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ 
        success: false, 
        error: `No questions available for stage ${stageId}. Please generate questions first.` 
      });
    }
    
    // Get all question details at once for better performance
    const questionIds = responses.map((r: any) => Number(r.questionId));
    
    console.log('Processing feedback with:', {
      stageId,
      responsesCount: responses.length,
      questionIds,
      validQuestionIds: questionIds.filter((id: number) => id && !isNaN(id)),
      availableQuestionIds: stageQuestions.map(q => q.id)
    });
    
    // Validate that we have question IDs
    if (!questionIds.length || questionIds.every((id: number) => !id || isNaN(id))) {
      console.error('No valid question IDs provided:', { questionIds, responses });
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ success: false, error: 'No valid question IDs provided' });
    }
    
    const questions = await questionRepository
      .createQueryBuilder('question')
      .where('question.id IN (:...ids)', { ids: questionIds })
      .getMany();
    
    console.log('Found questions:', questions.length);

    if (questions.length === 0) {
      await queryRunner.rollbackTransaction();
      return res.status(400).json({ success: false, error: 'No valid questions found' });
    }

    // Create a map for quick lookup
    const questionMap = new Map(questions.map(q => [q.id, q]));

    // Validate question IDs
    for (const response of responses) {
      const questionId = Number(response.questionId);
      if (!questionId || isNaN(questionId) || !questionMap.has(questionId)) {
        await queryRunner.rollbackTransaction();
        return res.status(400).json({ success: false, error: `Invalid question ID: ${response.questionId}` });
      }
    }

    // Create new attempt
    console.log('Creating attempt with:', {
      attemptId,
      userId,
      stageId,
      startTime: new Date(Date.now() - (timeSpent * 1000)),
      endTime: new Date(),
      timeSpentSeconds: timeSpent,
      isCompleted: true,
      score: 0
    });

    const attempt = attemptRepository.create({
      attemptId,
      user,
      stage,
      startTime: new Date(Date.now() - (timeSpent * 1000)),
      endTime: new Date(),
      timeSpentSeconds: timeSpent,
      isCompleted: true,
      score: 0
    });
    console.log('Attempt before save:', attempt);

    // Save attempt with error handling
    const savedAttempt = await attemptRepository.save(attempt).catch(err => {
      console.error('Failed to save attempt:', err);
      throw new Error(`Failed to save evaluation attempt: ${err.message}`);
    });
    console.log('Saved attempt:', savedAttempt);

    // Verify attempt was saved
    if (!savedAttempt.id) {
      await queryRunner.rollbackTransaction();
      return res.status(500).json({ success: false, error: 'Failed to save evaluation attempt' });
    }

    // Process responses
    const savedResponses = [];
    let correctCount = 0;
    let totalScore = 0;
    const userResponsesWithDetails = [];

    for (const response of responses) {
      const question = questionMap.get(Number(response.questionId));
      if (!question) continue;

      // For multiple choice, check if answer is correct
      let isCorrect = false;
      if (question.type === 'multiple-choice') {
        // Convert user answer (index) to the actual option text
        const userAnswerIndex = parseInt(response.answer);
        const userSelectedOption = question.options?.[userAnswerIndex];
        
        // Compare with the correct answer
        isCorrect = question.correctAnswer === userSelectedOption;
        
        console.log(`Multiple choice evaluation for question ${question.id}:`);
        console.log(`  User answer index: ${response.answer}`);
        console.log(`  User selected option: ${userSelectedOption}`);
        console.log(`  Correct answer: ${question.correctAnswer}`);
        console.log(`  Is correct: ${isCorrect}`);
      } else {
        // For open questions, evaluate with AI
        try {
          const aiEvaluation = await openRouterService.getInstance().evaluateOpenQuestion(
            question.questionText,
            response.answer,
            question.category || 'General',
            question.difficulty || 'intermediate'
          );
          isCorrect = aiEvaluation.isCorrect;
          console.log(`AI evaluation for question ${question.id}: ${isCorrect ? 'Correct' : 'Incorrect'}`);
        } catch (error) {
          console.error('Error evaluating open question with AI:', error);
          // Fallback: mark as incorrect if AI evaluation fails
          isCorrect = false;
        }
      }

      const pointsEarned = isCorrect ? question.points : 0;
      if (isCorrect) correctCount++;
      totalScore += pointsEarned;

      const userResponse = responseRepository.create({
        attempt: savedAttempt,
        question, // Use the question entity
        user,
        response: response.answer,
        isCorrect,
        pointsEarned
      });

      const savedResponse = await responseRepository.save(userResponse).catch(err => {
        console.error('Failed to save user response:', err);
        throw new Error(`Failed to save user response: ${err.message}`);
      });
      console.log('Saved user response:', savedResponse);
      savedResponses.push(savedResponse);
      
      userResponsesWithDetails.push({
        ...savedResponse,
        question: question.questionText,
        correctAnswer: question.correctAnswer,
        userSelectedOption: question.type === 'multiple-choice' ? question.options?.[parseInt(response.answer)] : null,
        type: question.type,
        options: question.options
      });
    }

    // Calculate final score
    const finalScore = Math.round((correctCount / responses.length) * 100);

    // Generate AI feedback
    const aiFeedback = await openRouterService.getInstance().generateFeedback(
      userResponsesWithDetails,
      questions,
      finalScore,
      responses.length,
      correctCount,
      stage.title
    );

    // Create feedback
    const feedback = feedbackRepository.create({
      attempt: savedAttempt,
      user,
      stage,
      score: finalScore,
      totalQuestions: responses.length,
      correctAnswers: correctCount,
      strengths: aiFeedback.strengths || [],
      improvements: aiFeedback.improvements || [],
      nextSteps: aiFeedback.nextSteps || '',
      detailedFeedback: aiFeedback.detailedFeedback || '',
      badge: aiFeedback.badge || 'QA Novice'
    });

    const savedFeedback = await feedbackRepository.save(feedback).catch(err => {
      console.error('Failed to save feedback:', err);
      throw new Error(`Failed to save feedback: ${err.message}`);
    });
    console.log('Saved feedback:', savedFeedback);

    // Update attempt with final score
    savedAttempt.score = finalScore;
    await attemptRepository.save(savedAttempt).catch(err => {
      console.error('Failed to update attempt score:', err);
      throw new Error(`Failed to update attempt score: ${err.message}`);
    });

    // Update user stage progress
    const userStageRepository = queryRunner.manager.getRepository(UserStage);
    
    console.log('About to update user stage progress with:', {
      userId: Number(userId),
      stageId: Number(stageId),
      finalScore,
      isCompleted: finalScore >= 60
    });
    
    // Check if user has already completed this stage
    let userStage = await userStageRepository.findOne({
      where: { userId: Number(userId), stageId: Number(stageId) }
    });

    if (!userStage) {
      // Create new user stage record
      const userIdNum = Number(userId);
      const stageIdNum = Number(stageId);
      
      console.log('Creating new user stage with:', {
        userId: userIdNum,
        stageId: stageIdNum,
        isCompleted: finalScore >= 60,
        score: finalScore,
        completedAt: finalScore >= 60 ? new Date() : null
      });
      
      userStage = userStageRepository.create({
        userId: userIdNum,
        stageId: stageIdNum,
        isCompleted: finalScore >= 60, // Mark as completed if score >= 60%
        score: finalScore,
        completedAt: finalScore >= 60 ? new Date() : null
      });
    } else {
      // Update existing record if new score is better
      if (finalScore >= 60 && !userStage.isCompleted) {
        userStage.isCompleted = true;
        userStage.completedAt = new Date();
      }
      if (finalScore > (userStage.score || 0)) {
        userStage.score = finalScore;
      }
    }

    await userStageRepository.save(userStage).catch(err => {
      console.error('Failed to update user stage progress:', err);
      throw new Error(`Failed to update user stage progress: ${err.message}`);
    });

    console.log('Updated user stage progress:', {
      userId: Number(userId),
      stageId: Number(stageId),
      isCompleted: userStage.isCompleted,
      score: userStage.score,
      completedAt: userStage.completedAt
    });

    // Update user's global score and current stage
    const userRepo = queryRunner.manager.getRepository(User);
    const currentUser = await userRepo.findOne({ where: { id: Number(userId) } });
    
    if (currentUser) {
      // Update global score
      const totalScore = await userStageRepository
        .createQueryBuilder('userStage')
        .select('SUM(userStage.score)', 'total')
        .where('userStage.userId = :userId', { userId: Number(userId) })
        .andWhere('userStage.isCompleted = :isCompleted', { isCompleted: true })
        .getRawOne();
      
      currentUser.globalScore = totalScore?.total || 0;
      
      // Update current stage to next stage if completed
      if (userStage.isCompleted) {
        const nextStage = await queryRunner.manager.getRepository(Stage).findOne({
          where: { 
            displayOrder: stage.displayOrder + 1,
            isActive: true 
          }
        });
        
        if (nextStage) {
          currentUser.currentStageId = nextStage.id;
        }
      }
      
      await userRepo.save(currentUser);
      console.log('Updated user global score:', currentUser.globalScore);
    }

    // Commit transaction
    await queryRunner.commitTransaction();

    // Prepare response
    res.status(201).json({
      success: true,
      feedbackId: savedFeedback.id,
      attemptId: savedAttempt.attemptId
    });

  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }
    console.error('Error submitting evaluation:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit evaluation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  } finally {
    await queryRunner.release();
  }
});

// Get feedback by ID
router.get('/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const feedbackId = parseInt(req.params.id);
    const feedbackRepository = AppDataSource.getRepository(Feedback);
    
    const feedback = await feedbackRepository.findOne({
      where: { 
        id: feedbackId,
        userId: req.user!.id // Ensure the feedback belongs to the authenticated user
      },
      relations: ['attempt', 'stage']
    });

    if (!feedback) {
      return res.status(404).json({ 
        success: false,
        error: 'Feedback not found' 
      });
    }

    res.json({
      success: true,
      data: feedback
    });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch feedback',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get feedback for an attempt
router.get('/attempts/:attemptId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const attemptId = parseInt(req.params.attemptId);
    const feedbackRepository = AppDataSource.getRepository(Feedback);
    
    const feedback = await feedbackRepository.findOne({
      where: { attemptId, userId: req.user!.id },
      relations: ['attempt', 'stage']
    });

    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    res.json({ feedback });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// Get user's feedback for a stage
router.get('/stages/:stageId', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const stageId = parseInt(req.params.stageId);
    const feedbackRepository = AppDataSource.getRepository(Feedback);
    
    const feedbacks = await feedbackRepository.find({
      where: { stageId, userId: req.user!.id },
      relations: ['attempt'],
      order: { createdAt: 'DESC' }
    });

    res.json({ feedbacks });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stage feedback' });
  }
});

export default router;
