import { Router } from 'express';
import { AppDataSource } from '../config/database';
import { EvaluationAttempt } from '../entities/EvaluationAttempt';
import { Stage } from '../entities/Stage';
import { User } from '../entities/User';
import { authMiddleware } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

const router = Router();

// Cache para AI feedback (5 minutos)
const aiFeedbackCache = new Map<string, { feedback: any; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// Get skills analytics with filters - OPTIMIZADO
router.get('/analytics', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    
    const { timeFilter = 'all', stageId } = req.query;

    const attemptRepository = AppDataSource.getRepository(EvaluationAttempt);
    const stageRepository = AppDataSource.getRepository(Stage);

    // Optimización 1: Usar QueryBuilder para mejor rendimiento
    const queryBuilder = attemptRepository
      .createQueryBuilder('attempt')
      .leftJoinAndSelect('attempt.stage', 'stage')
      .where('attempt.userId = :userId', { userId });

    if (stageId) {
      queryBuilder.andWhere('attempt.stageId = :stageId', { stageId: parseInt(stageId as string) });
    }

    // Optimización 2: Aplicar filtro de fecha en SQL
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
      queryBuilder.andWhere('attempt.createdAt >= :filterDate', { filterDate });
    }

    queryBuilder.orderBy('attempt.createdAt', 'DESC');

    const attempts = await queryBuilder.getMany();

    // Optimización 3: Calcular métricas de manera más eficiente
    const stageMetricsMap = new Map();
    let totalScore = 0;
    let totalTimeSpent = 0;
    let completedAttempts = 0;
    const passedStages = new Set<number>();

    for (const attempt of attempts) {
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
        totalScore += attempt.score;
      }
      
      if (attempt.timeSpentSeconds !== null) {
        metrics.totalTimeSpent += attempt.timeSpentSeconds;
        totalTimeSpent += attempt.timeSpentSeconds;
      }
      
      if (attempt.isCompleted) {
        metrics.completedAttempts++;
        completedAttempts++;
        
        if (attempt.score !== null && attempt.score >= 70) {
          passedStages.add(stageId);
        }
      }
      
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

    // Optimización 4: Calcular métricas generales de manera más eficiente
    const totalAttempts = attempts.length;
    const averageScore = totalAttempts > 0 ? totalScore / totalAttempts : 0;
    
    // Optimización 5: Obtener stages de manera más eficiente
    const allStages = await stageRepository.find({ 
      where: { isActive: true },
      select: ['id', 'title'] // Solo seleccionar campos necesarios
    });

    // Optimización 6: Calcular improvement rate de manera más eficiente
    let improvementRate = 0;
    if (attempts.length >= 2) {
      const sortedAttempts = attempts.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      
      const midPoint = Math.floor(sortedAttempts.length / 2);
      const firstHalf = sortedAttempts.slice(0, midPoint);
      const secondHalf = sortedAttempts.slice(midPoint);
      
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

    // Optimización 7: Cache para AI feedback
    const cacheKey = `${userId}-${timeFilter}-${stageId || 'all'}`;
    const cachedFeedback = aiFeedbackCache.get(cacheKey);
    
    let aiFeedback;
    if (cachedFeedback && (Date.now() - cachedFeedback.timestamp) < CACHE_DURATION) {
      aiFeedback = cachedFeedback.feedback;
    } else {
      // Solo generar AI feedback si no hay cache válido
      aiFeedback = await generateAIFeedback(attempts, stageMetrics, overallMetrics);
      aiFeedbackCache.set(cacheKey, { feedback: aiFeedback, timestamp: Date.now() });
    }

    res.json({
      attempts: attempts.map(attempt => ({
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

// Helper function to generate AI feedback - OPTIMIZADA
async function generateAIFeedback(attempts: any[], stageMetrics: any[], overallMetrics: any) {
  try {
    // Optimización: Generar feedback más simple y rápido sin llamada a IA
    const general = generateGeneralFeedback(overallMetrics, stageMetrics);
    const stageSpecific = generateStageSpecificFeedback(stageMetrics, attempts);
    
    return {
      general,
      stageSpecific
    };
    
  } catch (error) {
    console.error('Error generating AI feedback:', error);
    return {
      general: '## Análisis de Progreso\n\nNo se pudo generar el análisis en este momento.',
      stageSpecific: {}
    };
  }
}

// Función optimizada para generar feedback general
function generateGeneralFeedback(overallMetrics: any, stageMetrics: any[]) {
  const { totalAttempts, averageScore, totalTimeSpent, completedStages, totalStages, improvementRate } = overallMetrics;
  
  let feedback = '## Análisis General del Progreso\n\n';
  
  // Evaluar rendimiento general
  if (averageScore >= 80) {
    feedback += `**¡Excelente rendimiento!** 🎉\n\n`;
    feedback += `Tu puntuación promedio de **${averageScore.toFixed(1)}%** indica un dominio excepcional de los conceptos de QA.\n\n`;
  } else if (averageScore >= 60) {
    feedback += `**Buen progreso** 📈\n\n`;
    feedback += `Tu puntuación promedio de **${averageScore.toFixed(1)}%** muestra una comprensión sólida de los conceptos básicos.\n\n`;
  } else {
    feedback += `**Necesitas más práctica** ⚠️\n\n`;
    feedback += `Tu puntuación promedio de **${averageScore.toFixed(1)}%** indica que necesitas revisar los conceptos fundamentales.\n\n`;
  }
  
  // Estadísticas generales
  feedback += `### Estadísticas Generales:\n`;
  feedback += `- **Total de intentos:** ${totalAttempts}\n`;
  feedback += `- **Tiempo total invertido:** ${Math.floor(totalTimeSpent / 60)} minutos\n`;
  feedback += `- **Stages completados:** ${completedStages}/${totalStages}\n`;
  
  if (improvementRate > 0) {
    feedback += `- **Tasa de mejora:** +${improvementRate.toFixed(1)}%\n`;
  }
  
  feedback += `\n### Recomendaciones:\n`;
  
  if (averageScore >= 80) {
    feedback += `- Explora temas avanzados relacionados\n`;
    feedback += `- Comparte tu conocimiento con otros\n`;
    feedback += `- Mantén la práctica regular\n`;
  } else if (averageScore >= 60) {
    feedback += `- Revisa los temas de menor puntuación\n`;
    feedback += `- Practica más en áreas específicas\n`;
    feedback += `- Considera evaluaciones adicionales\n`;
  } else {
    feedback += `- Revisa los materiales desde el principio\n`;
    feedback += `- Practica con ejercicios básicos\n`;
    feedback += `- Busca ayuda o recursos adicionales\n`;
  }
  
  return feedback;
}

// Función optimizada para generar feedback específico por stage
function generateStageSpecificFeedback(stageMetrics: any[], attempts: any[]) {
  const stageSpecific: Record<number, string> = {};
  
  for (const stage of stageMetrics) {
    const { stageId, stageTitle, averageScore, bestScore, totalAttempts, completionRate } = stage;
    
    let feedback = `## ${stageTitle}\n\n`;
    
    // Análisis de rendimiento
    if (averageScore >= 80) {
      feedback += `**¡Excelente rendimiento!** 🎉\n\n`;
      feedback += `Puntuación promedio: **${averageScore.toFixed(1)}%**\n`;
      feedback += `Mejor puntuación: **${bestScore.toFixed(1)}%**\n`;
      feedback += `Tasa de completado: **${completionRate.toFixed(1)}%**\n\n`;
      
      feedback += `### Fortalezas:\n`;
      feedback += `- Dominio excepcional de los conceptos\n`;
      feedback += `- Consistencia en el rendimiento\n`;
      feedback += `- Capacidad de aplicación práctica\n\n`;
      
    } else if (averageScore >= 60) {
      feedback += `**Buen progreso** 📈\n\n`;
      feedback += `Puntuación promedio: **${averageScore.toFixed(1)}%**\n`;
      feedback += `Mejor puntuación: **${bestScore.toFixed(1)}%**\n`;
      feedback += `Tasa de completado: **${completionRate.toFixed(1)}%**\n\n`;
      
      feedback += `### Áreas de mejora:\n`;
      feedback += `- Revisa temas de menor puntuación\n`;
      feedback += `- Practica más en áreas específicas\n`;
      feedback += `- Considera evaluaciones adicionales\n\n`;
      
    } else {
      feedback += `**Necesitas más práctica** ⚠️\n\n`;
      feedback += `Puntuación promedio: **${averageScore.toFixed(1)}%**\n`;
      feedback += `Tasa de completado: **${completionRate.toFixed(1)}%**\n\n`;
      
      feedback += `### Plan de acción:\n`;
      feedback += `- Revisa los materiales desde el principio\n`;
      feedback += `- Practica con ejercicios básicos\n`;
      feedback += `- Busca ayuda o recursos adicionales\n\n`;
    }
    
    // Análisis de intentos recientes
    const stageAttempts = attempts.filter(attempt => attempt.stageId === stageId);
    const recentAttempts = stageAttempts.slice(0, 3);
    
    if (recentAttempts.length > 0) {
      feedback += `### Intentos recientes:\n`;
      recentAttempts.forEach((attempt, index) => {
        const attemptScore = Math.round(attempt.score || 0);
        const attemptDate = new Date(attempt.createdAt).toLocaleDateString('es-ES');
        feedback += `- **Intento ${index + 1}** (${attemptDate}): ${attemptScore}%\n`;
      });
      feedback += `\n`;
    }
    
    stageSpecific[stageId] = feedback;
  }
  
  return stageSpecific;
}

export default router; 