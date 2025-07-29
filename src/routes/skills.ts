import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { EvaluationAttempt } from '../entities/EvaluationAttempt';
import { Stage } from '../entities/Stage';
import { User } from '../entities/User';
import { authMiddleware } from '../middleware/auth';
import { openRouterService } from '../services/openRouterService';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Get skills analytics with filters
router.get('/analytics', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { timeFilter = 'all', stageId } = req.query;

    const attemptRepository = AppDataSource.getRepository(EvaluationAttempt);
    const stageRepository = AppDataSource.getRepository(Stage);

    // Get attempts with filters
    let whereClause: any = { userId };
    if (stageId) {
      whereClause.stageId = parseInt(stageId as string);
    }

    const attempts = await attemptRepository.find({
      where: whereClause,
      relations: ['stage'],
      order: { createdAt: 'DESC' }
    });

    // Filter by date if needed
    let filteredAttempts = attempts;
    if (timeFilter !== 'all') {
      const filterDate = new Date();
      switch (timeFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(filterDate.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(filterDate.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(filterDate.getFullYear() - 1);
          break;
      }
      filteredAttempts = attempts.filter(attempt => 
        new Date(attempt.createdAt) >= filterDate
      );
    }

    // Calculate stage metrics
    const stageMetricsMap = new Map();
    for (const attempt of filteredAttempts) {
      const stageId = attempt.stageId;
      if (!stageMetricsMap.has(stageId)) {
        stageMetricsMap.set(stageId, {
          stageId,
          stageTitle: attempt.stage.title,
          totalAttempts: 0,
          scores: [],
          bestScore: 0,
          totalTimeSpent: 0,
          completedAttempts: 0,
          lastAttemptDate: null
        });
      }

      const metrics = stageMetricsMap.get(stageId);
      metrics.totalAttempts++;
      if (attempt.score !== null) {
        metrics.scores.push(attempt.score);
        metrics.bestScore = Math.max(metrics.bestScore, attempt.score);
      }
      if (attempt.timeSpentSeconds !== null) {
        metrics.totalTimeSpent += attempt.timeSpentSeconds;
      }
      if (attempt.isCompleted) metrics.completedAttempts++;
      
      const attemptDate = new Date(attempt.createdAt);
      if (!metrics.lastAttemptDate || attemptDate > new Date(metrics.lastAttemptDate)) {
        metrics.lastAttemptDate = attempt.createdAt.toISOString();
      }
    }

    const stageMetrics = Array.from(stageMetricsMap.values()).map(metrics => ({
      stageId: metrics.stageId,
      stageTitle: metrics.stageTitle,
      totalAttempts: metrics.totalAttempts,
      averageScore: metrics.scores.length > 0 ? 
        metrics.scores.reduce((a: number, b: number) => a + b, 0) / metrics.scores.length : 0,
      bestScore: metrics.bestScore,
      totalTimeSpent: metrics.totalTimeSpent,
      completionRate: metrics.totalAttempts > 0 ? 
        (metrics.completedAttempts / metrics.totalAttempts) * 100 : 0,
      lastAttemptDate: metrics.lastAttemptDate
    }));

    // Calculate overall metrics
    const totalAttempts = filteredAttempts.length;
    const averageScore = totalAttempts > 0 ? 
      filteredAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / totalAttempts : 0;
    const totalTimeSpent = filteredAttempts.reduce((sum, attempt) => sum + (attempt.timeSpentSeconds || 0), 0);
    
    // Get all stages and completed stages
    const allStages = await stageRepository.find({ where: { isActive: true } });
    const passedStages = new Set(
      filteredAttempts
        .filter(attempt => attempt.isCompleted && (attempt.score || 0) >= 70) // Score >= 70% (already in percentage)
        .map(attempt => attempt.stageId)
    );

    // Calculate improvement rate (simplified - could be more sophisticated)
    const sortedAttempts = [...filteredAttempts].sort((a: EvaluationAttempt, b: EvaluationAttempt) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    let improvementRate = 0;
    if (sortedAttempts.length >= 2) {
      const firstHalf = sortedAttempts.slice(0, Math.floor(sortedAttempts.length / 2));
      const secondHalf = sortedAttempts.slice(Math.floor(sortedAttempts.length / 2));
      
      const firstAvg = firstHalf.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / secondHalf.length;
      
      improvementRate = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    }

    const overallMetrics = {
      totalAttempts,
      averageScore,
      totalTimeSpent,
      completedStages: passedStages.size,
      totalStages: allStages.length,
      improvementRate
    };

    // Generate AI feedback
    const aiFeedback = await generateAIFeedback(filteredAttempts, stageMetrics, overallMetrics);
    
    console.log('Debug AI Feedback:', aiFeedback);

    res.json({
      attempts: filteredAttempts.map(attempt => ({
        id: attempt.id,
        stageId: attempt.stageId,
        stageDisplayOrder: attempt.stage.displayOrder,
        stageTitle: attempt.stage.title,
        score: attempt.score || 0,
        maxScore: 10,
        timeSpent: attempt.timeSpentSeconds || 0,
        completedAt: attempt.createdAt.toISOString(),
        isCompleted: attempt.isCompleted
      })),
      stageMetrics,
      overallMetrics,
      aiFeedback
    });

  } catch (error) {
    console.error('Error getting skills analytics:', error);
    res.status(500).json({ error: 'Failed to get skills analytics' });
  }
});

// Get attempts with filters
router.get('/attempts', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { timeFilter = 'all', stageId } = req.query;

    const attemptRepository = AppDataSource.getRepository(EvaluationAttempt);
    
    let whereClause: any = { userId };
    if (stageId) {
      whereClause.stageId = parseInt(stageId as string);
    }

    const attempts = await attemptRepository.find({
      where: whereClause,
      relations: ['stage'],
      order: { createdAt: 'DESC' }
    });

    // Apply time filter
    let filteredAttempts = attempts;
    if (timeFilter !== 'all') {
      const filterDate = new Date();
      switch (timeFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(filterDate.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(filterDate.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(filterDate.getFullYear() - 1);
          break;
      }
      filteredAttempts = attempts.filter(attempt => 
        new Date(attempt.createdAt) >= filterDate
      );
    }

    res.json({
      attempts: filteredAttempts.map(attempt => ({
        id: attempt.id,
        stageId: attempt.stageId,
        stageTitle: attempt.stage.title,
        score: attempt.score || 0,
        maxScore: 10,
        timeSpent: attempt.timeSpentSeconds || 0,
        completedAt: attempt.createdAt.toISOString(),
        isCompleted: attempt.isCompleted
      }))
    });

  } catch (error) {
    console.error('Error getting attempts:', error);
    res.status(500).json({ error: 'Failed to get attempts' });
  }
});

// Get AI feedback
router.get('/feedback', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { timeFilter = 'all', stageId } = req.query;

    const attemptRepository = AppDataSource.getRepository(EvaluationAttempt);
    
    let whereClause: any = { userId };
    if (stageId) {
      whereClause.stageId = parseInt(stageId as string);
    }

    const attempts = await attemptRepository.find({
      where: whereClause,
      relations: ['stage'],
      order: { createdAt: 'DESC' }
    });

    // Apply time filter
    let filteredAttempts = attempts;
    if (timeFilter !== 'all') {
      const filterDate = new Date();
      switch (timeFilter) {
        case 'today':
          filterDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          filterDate.setDate(filterDate.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(filterDate.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(filterDate.getFullYear() - 1);
          break;
      }
      filteredAttempts = attempts.filter(attempt => 
        new Date(attempt.createdAt) >= filterDate
      );
    }

    // Calculate metrics for AI feedback
    const stageMetricsMap = new Map();
    for (const attempt of filteredAttempts) {
      const stageId = attempt.stageId;
      if (!stageMetricsMap.has(stageId)) {
        stageMetricsMap.set(stageId, {
          stageId,
          stageTitle: attempt.stage.title,
          totalAttempts: 0,
          scores: [],
          completedAttempts: 0
        });
      }

      const metrics = stageMetricsMap.get(stageId);
      metrics.totalAttempts++;
      if (attempt.score !== null) {
        metrics.scores.push(attempt.score);
      }
      if (attempt.isCompleted) metrics.completedAttempts++;
    }

    const stageMetrics = Array.from(stageMetricsMap.values()).map(metrics => ({
      stageId: metrics.stageId,
      stageTitle: metrics.stageTitle,
      totalAttempts: metrics.totalAttempts,
      averageScore: metrics.scores.length > 0 ? 
        metrics.scores.reduce((a: number, b: number) => a + b, 0) / metrics.scores.length : 0,
      completionRate: metrics.totalAttempts > 0 ? 
        (metrics.completedAttempts / metrics.totalAttempts) * 100 : 0
    }));

    const overallMetrics = {
      totalAttempts: filteredAttempts.length,
      averageScore: filteredAttempts.length > 0 ? 
        filteredAttempts.reduce((sum, attempt) => sum + (attempt.score || 0), 0) / filteredAttempts.length : 0,
      totalTimeSpent: filteredAttempts.reduce((sum, attempt) => sum + (attempt.timeSpentSeconds || 0), 0)
    };

    const aiFeedback = await generateAIFeedback(filteredAttempts, stageMetrics, overallMetrics);

    res.json(aiFeedback);

  } catch (error) {
    console.error('Error getting AI feedback:', error);
    res.status(500).json({ error: 'Failed to get AI feedback' });
  }
});

// Helper function to generate AI feedback
async function generateAIFeedback(attempts: any[], stageMetrics: any[], overallMetrics: any) {
  try {
    const prompt = `
Analiza el rendimiento del usuario en evaluaciones de QA y proporciona feedback personalizado en formato Markdown.

Datos del usuario:
- Total de intentos: ${overallMetrics.totalAttempts}
- Puntuación promedio: ${overallMetrics.averageScore.toFixed(1)}/10
- Tiempo total invertido: ${Math.floor(overallMetrics.totalTimeSpent / 60)} minutos

Métricas por stage:
${stageMetrics.map(stage => 
  `- ${stage.stageTitle}: ${stage.averageScore.toFixed(1)}/10 promedio, ${stage.completionRate.toFixed(1)}% completado`
).join('\n')}

Proporciona un análisis completo en formato Markdown que incluya:

## Análisis General del Progreso
- Evalúa el rendimiento general
- Identifica fortalezas y áreas de mejora
- Comenta sobre el tiempo invertido y la consistencia

## Feedback Específico por Stage
- Analiza cada stage individualmente
- Identifica patrones de rendimiento
- Sugiere áreas específicas de mejora por stage

## Recomendaciones Específicas para Mejorar
- 3-5 recomendaciones concretas y accionables
- Basadas en los datos reales del usuario
- Incluye sugerencias de recursos o estrategias

Responde en español de manera motivacional pero honesta, usando los datos reales proporcionados y formato Markdown.
    `;

    // Generate feedback using chat completion
    const messages = [
      {
        role: 'system' as const,
        content: 'Eres un experto en Quality Assurance (QA) y análisis de habilidades. Debes proporcionar feedback personalizado y motivacional basado en el rendimiento del usuario. Responde siempre en formato Markdown.'
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ];
    
    const response = await openRouterService.getInstance().generateCompletion(messages);
    
    console.log('AI Response type:', typeof response);
    console.log('AI Response:', response);
    
    // Parse the AI response and structure it
    const feedbackText = response; // response is already a string from generateCompletion
    
    // Use the full AI response as general feedback
    const general = feedbackText || '## Excelente Progreso\n\nHas mostrado un excelente progreso en tu aprendizaje de QA.';
    
    const stageSpecific: Record<number, string> = {};
    
    // Generate detailed feedback for each stage
    for (const stage of stageMetrics) {
      const scorePercentage = stage.averageScore; // Score is already 0-100
      const bestScorePercentage = stage.bestScore; // Score is already 0-100
      
      // Get attempts for this specific stage
      const stageAttempts = attempts.filter(attempt => attempt.stageId === stage.stageId);
      const recentAttempts = stageAttempts.slice(0, 3); // Get last 3 attempts
      
      let feedback = `## ${stage.stageTitle}\n\n`;
      
      // Performance analysis
      if (scorePercentage >= 80) {
        feedback += `**¡Excelente rendimiento!** 🎉\n\n`;
        feedback += `Has demostrado un dominio excepcional de los conceptos en **${stage.stageTitle}**. Tu puntuación promedio de **${scorePercentage.toFixed(0)}%** indica una comprensión profunda y sólida del material.\n\n`;
        
        if (bestScorePercentage >= 90) {
          feedback += `**Logro destacado:** Tu mejor puntuación de **${bestScorePercentage.toFixed(0)}%** muestra que puedes alcanzar niveles de excelencia en este área.\n\n`;
        }
        
        feedback += `### Fortalezas identificadas:\n`;
        feedback += `- Comprensión profunda de los conceptos fundamentales\n`;
        feedback += `- Consistencia en el rendimiento\n`;
        feedback += `- Capacidad para aplicar conocimientos en situaciones prácticas\n\n`;
        
        feedback += `### Áreas de mejora:\n`;
        feedback += `- Considera explorar temas avanzados relacionados\n`;
        feedback += `- Mantén la práctica regular para conservar el dominio\n`;
        feedback += `- Comparte tu conocimiento con otros estudiantes\n\n`;
        
      } else if (scorePercentage >= 60) {
        feedback += `**Buen progreso** 📈\n\n`;
        feedback += `Has mostrado una comprensión sólida de **${stage.stageTitle}** con una puntuación promedio de **${scorePercentage.toFixed(0)}%**. Esto indica un buen dominio de los conceptos básicos.\n\n`;
        
        feedback += `### Fortalezas identificadas:\n`;
        feedback += `- Comprensión adecuada de los conceptos principales\n`;
        feedback += `- Capacidad para completar evaluaciones\n`;
        feedback += `- Base sólida para continuar aprendiendo\n\n`;
        
        feedback += `### Áreas de mejora:\n`;
        feedback += `- Revisa los temas donde obtuviste puntuaciones más bajas\n`;
        feedback += `- Practica más en áreas específicas de dificultad\n`;
        feedback += `- Considera tomar evaluaciones adicionales para reforzar conocimientos\n\n`;
        
      } else if (scorePercentage >= 40) {
        feedback += `**Necesitas más práctica** ⚠️\n\n`;
        feedback += `Tu puntuación promedio de **${scorePercentage.toFixed(0)}%** en **${stage.stageTitle}** indica que necesitas revisar y reforzar los conceptos fundamentales.\n\n`;
        
        feedback += `### Análisis del rendimiento:\n`;
        feedback += `- Algunos conceptos básicos requieren más atención\n`;
        feedback += `- La consistencia en el rendimiento puede mejorarse\n`;
        feedback += `- Se recomienda dedicar más tiempo a este stage\n\n`;
        
        feedback += `### Plan de mejora:\n`;
        feedback += `- Revisa los materiales desde el principio\n`;
        feedback += `- Practica con ejercicios adicionales\n`;
        feedback += `- Considera buscar ayuda o recursos adicionales\n\n`;
        
      } else {
        feedback += `**Requieres más estudio** 📚\n\n`;
        feedback += `Tu puntuación promedio de **${scorePercentage.toFixed(0)}%** en **${stage.stageTitle}** sugiere que necesitas una revisión completa de los conceptos fundamentales.\n\n`;
        
        feedback += `### Análisis del rendimiento:\n`;
        feedback += `- Los conceptos básicos necesitan más atención\n`;
        feedback += `- Se recomienda tomar el curso desde el principio\n`;
        feedback += `- Considera dedicar más tiempo al estudio\n\n`;
        
        feedback += `### Plan de acción:\n`;
        feedback += `- Revisa todos los materiales desde el inicio\n`;
        feedback += `- Practica con ejercicios básicos\n`;
        feedback += `- Considera buscar tutoría o ayuda adicional\n\n`;
      }
      
      // Add recent performance analysis
      if (recentAttempts.length > 0) {
        feedback += `### Análisis de intentos recientes:\n`;
        recentAttempts.forEach((attempt, index) => {
          const attemptScore = Math.round(attempt.score); // Score is already 0-100
          const attemptDate = new Date(attempt.createdAt).toLocaleDateString('es-ES');
          feedback += `- **Intento ${index + 1}** (${attemptDate}): ${attemptScore}%\n`;
        });
        feedback += `\n`;
      }
      
      // Add specific recommendations
      feedback += `### Recomendaciones específicas:\n`;
      if (scorePercentage >= 80) {
        feedback += `- Mantén la práctica regular para conservar el dominio\n`;
        feedback += `- Explora temas avanzados relacionados con ${stage.stageTitle}\n`;
        feedback += `- Considera ayudar a otros estudiantes\n`;
        feedback += `- Documenta tus mejores prácticas\n`;
      } else if (scorePercentage >= 60) {
        feedback += `- Revisa los temas donde obtuviste puntuaciones más bajas\n`;
        feedback += `- Practica con ejercicios adicionales\n`;
        feedback += `- Toma evaluaciones adicionales para reforzar conocimientos\n`;
        feedback += `- Establece metas específicas de mejora\n`;
      } else {
        feedback += `- Revisa los materiales desde el principio\n`;
        feedback += `- Practica con ejercicios básicos\n`;
        feedback += `- Considera buscar ayuda o recursos adicionales\n`;
        feedback += `- Establece un plan de estudio estructurado\n`;
      }
      
      feedback += `\n**¡Sigue así!** Tu dedicación al aprendizaje es admirable. 🚀\n`;
      
      stageSpecific[stage.stageId] = feedback;
    }

    // Extract recommendations from the AI response
    const recommendations = [];
    const lines = feedbackText.split('\n');
    let inRecommendationsSection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.includes('RECOMENDACIONES') || trimmedLine.includes('recomendaciones')) {
        inRecommendationsSection = true;
        continue;
      }
      
      if (inRecommendationsSection && trimmedLine.match(/^\d+\./)) {
        // Extract numbered recommendations
        const recommendation = trimmedLine.replace(/^\d+\.\s*/, '').trim();
        if (recommendation) {
          recommendations.push(recommendation);
        }
      } else if (inRecommendationsSection && trimmedLine.startsWith('-')) {
        // Extract bullet point recommendations
        const recommendation = trimmedLine.replace(/^-\s*/, '').trim();
        if (recommendation) {
          recommendations.push(recommendation);
        }
      }
    }
    
    // Fallback recommendations if none were extracted
    if (recommendations.length === 0) {
      recommendations.push(
        'Continúa practicando regularmente para mantener y mejorar tus habilidades',
        'Revisa los conceptos donde tengas menor puntuación para fortalecer tus debilidades',
        'Mantén un ritmo de estudio consistente para optimizar tu aprendizaje',
        'Considera tomar evaluaciones adicionales para medir tu progreso',
        'Busca recursos adicionales en áreas donde necesites más práctica'
      );
    }

    return {
      general,
      stageSpecific,
      recommendations
    };

  } catch (error) {
    console.error('Error generating AI feedback:', error);
    return {
      general: '## Excelente Progreso\n\nHas mostrado un excelente progreso en tu aprendizaje de QA. Continúa practicando para mejorar tus habilidades.',
      stageSpecific: {},
      recommendations: [
        'Practica regularmente para mantener y mejorar tus habilidades',
        'Revisa los conceptos difíciles para fortalecer tus debilidades',
        'Mantén un ritmo de estudio consistente para optimizar tu aprendizaje'
      ]
    };
  }
}

export default router; 