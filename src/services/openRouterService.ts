import axios from 'axios';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file in development
if (process.env.NODE_ENV !== 'production') {
  const envPath = path.resolve(process.cwd(), '.env');
  dotenv.config({ path: envPath });
}

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class OpenRouterService {
  private static instance: OpenRouterService | null = null;
  private readonly apiKey: string;

  private constructor() {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        'OPENROUTER_API_KEY is not defined in your environment variables.\n' +
        'Please make sure you have a .env file in your project root with the following line:\n' +
        'OPENROUTER_API_KEY=your_api_key_here\n' +
        'Current working directory: ' + process.cwd()
      );
    }
    this.apiKey = apiKey;
  }

  public static getInstance(): OpenRouterService {
    if (!OpenRouterService.instance) {
      try {
        OpenRouterService.instance = new OpenRouterService();
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
        console.error('Failed to initialize OpenRouterService:', errorMessage);
        throw new Error(`OpenRouterService initialization failed: ${errorMessage}`);
      }
    }
    return OpenRouterService.instance;
  }

  async generateCompletion(messages: OpenRouterMessage[], model: string = 'anthropic/claude-3.5-sonnet'): Promise<string> {
    try {
      const response = await axios.post(
        `${OPENROUTER_BASE_URL}/chat/completions`,
        {
          model,
          messages,
          max_tokens: 4000,
          temperature: 0.7,
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      throw new Error('Failed to generate AI response');
    }
  }

  async generateQuestions(stageTitle: string, difficulty: string, openQuestions: number, closedQuestions: number): Promise<any> {
    const systemPrompt = `Eres un experto en Quality Assurance (QA) y testing de software. Debes generar preguntas para evaluar conocimientos específicos en QA.

INSTRUCCIONES IMPORTANTES:
- Genera exactamente ${openQuestions} preguntas abiertas y ${closedQuestions} preguntas de opción múltiple
- Las preguntas deben ser relevantes para el tema: "${stageTitle}"
- Nivel de dificultad: ${difficulty}
- Para preguntas de opción múltiple, incluye exactamente 4 opciones
- Las preguntas abiertas deben permitir respuestas de 2-3 párrafos
- Responde ÚNICAMENTE con un JSON válido, sin texto adicional

FORMATO DE RESPUESTA (JSON):
{
  "questions": [
    {
      "type": "open-text",
      "questionText": "Pregunta abierta aquí...",
      "category": "Categoría específica",
      "points": 2,
      "difficulty": "${difficulty}"
    },
    {
      "type": "multiple-choice",
      "questionText": "Pregunta de opción múltiple aquí...",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "correctAnswer": "Opción A",
      "category": "Categoría específica",
      "points": 1,
      "difficulty": "${difficulty}"
    }
  ]
}`;

    const userPrompt = `Genera preguntas para evaluar: ${stageTitle}
Dificultad: ${difficulty}
Preguntas abiertas: ${openQuestions}
Preguntas de opción múltiple: ${closedQuestions}

Las preguntas deben cubrir conceptos fundamentales, mejores prácticas, herramientas y metodologías de QA relevantes para este tema.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse AI response as JSON:', response);
      throw new Error('Invalid AI response format');
    }
  }

  async generateFeedback(
    userResponses: any[],
    questions: any[],
    score: number,
    totalQuestions: number,
    correctAnswers: number,
    stageTitle: string
  ): Promise<any> {
    const systemPrompt = `Eres un experto mentor en Quality Assurance (QA) que proporciona feedback constructivo y personalizado.

INSTRUCCIONES:
- Analiza las respuestas del usuario y genera feedback detallado
- Identifica fortalezas específicas y áreas de mejora
- Proporciona pasos concretos para mejorar
- Asigna una insignia apropiada basada en el rendimiento
- Mantén un tono profesional pero alentador

RESPONDE ÚNICAMENTE con un JSON válido:
{
  "strengths": ["Fortaleza 1", "Fortaleza 2", "..."],
  "improvements": ["Área de mejora 1", "Área de mejora 2", "..."],
  "nextSteps": "Recomendaciones específicas para continuar aprendiendo...",
  "detailedFeedback": "Análisis detallado del desempeño, incluyendo comentarios específicos sobre respuestas...",  
  "badge": "Nombre de la insignia ganada"
}

INSIGNIAS POSIBLES:
- "QA Novice" (0-40%)
- "QA Apprentice" (41-60%) 
- "QA Practitioner" (61-80%)
- "QA Expert" (81-95%)
- "QA Master" (96-100%)`;

    const userPrompt = `Analiza este desempeño en la evaluación de ${stageTitle}:

RESULTADOS:
- Puntaje: ${score}%
- Preguntas correctas: ${correctAnswers}/${totalQuestions}

RESPUESTAS DEL USUARIO:
${userResponses.map((resp, idx) => `
Pregunta ${idx + 1}: ${questions[idx]?.questionText}
Respuesta: ${resp.response}
Correcta: ${resp.isCorrect ? 'Sí' : 'No'}
${questions[idx]?.type === 'multiple-choice' ? `Respuesta correcta: ${questions[idx]?.correctAnswer}` : ''}
`).join('\n')}

Genera feedback constructivo y personalizado.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse feedback response as JSON:', response);
      throw new Error('Invalid feedback response format');
    }
  }

  getInstance(): OpenRouterService {
    if (!OpenRouterService.instance) {
      OpenRouterService.instance = new OpenRouterService();
    }
    return OpenRouterService.instance;
  }
}

// Export a function that returns the singleton instance
export const getOpenRouterService = (): OpenRouterService => {
  return OpenRouterService.getInstance();
};

// For backward compatibility - but don't instantiate immediately
let _openRouterService: OpenRouterService | null = null;

export const openRouterService = {
  getInstance: (): OpenRouterService => {
    if (!_openRouterService) {
      _openRouterService = OpenRouterService.getInstance();
    }
    return _openRouterService;
  }
};
