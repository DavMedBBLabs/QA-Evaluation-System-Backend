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
          timeout: 90000, // 90 seconds timeout
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('OpenRouter API Error:', error);
      
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
          throw new Error('Request timeout: The AI service is taking too long to respond');
        }
        if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
          throw new Error('Network error: Unable to connect to AI service');
        }
        if (error.response?.status === 401) {
          throw new Error('Authentication error: Invalid API key');
        }
        if (error.response?.status === 429) {
          throw new Error('Rate limit exceeded: Too many requests to AI service');
        }
      }
      
      throw new Error('Failed to generate AI response');
    }
  }

  async generateQuestions(
    stageTitle: string, 
    difficulty: string, 
    openQuestions: number, 
    closedQuestions: number,
    considerations?: string
  ): Promise<any> {
    const systemPrompt = `Eres un experto en Quality Assurance (QA) y testing de software. Debes generar preguntas para evaluar conocimientos específicos en QA.

INSTRUCCIONES IMPORTANTES:
- Genera exactamente ${openQuestions} preguntas abiertas y ${closedQuestions} preguntas de opción múltiple
- Las preguntas deben ser relevantes para el tema: "${stageTitle}"
- Nivel de dificultad: ${difficulty}
${considerations ? `- Consideraciones específicas: ${considerations}` : ''}
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

  async evaluateOpenQuestion(
    questionText: string,
    userAnswer: string,
    category: string,
    difficulty: string
  ): Promise<{ isCorrect: boolean; explanation: string }> {
    const systemPrompt = `Eres un experto evaluador de Quality Assurance (QA) que evalúa respuestas a preguntas abiertas.

INSTRUCCIONES:
- Evalúa si la respuesta del usuario es correcta para la pregunta dada
- Considera el contexto de QA y testing
- Una respuesta es correcta si demuestra comprensión del concepto
- Sé más flexible con respuestas cortas pero coherentes
- Responde ÚNICAMENTE con un JSON válido

CRITERIOS DE EVALUACIÓN:
- Respuestas de menos de 2 líneas de texto: EVALUAR CON FLEXIBILIDAD
- Respuestas que no abordan la pregunta: INCORRECTA
- Respuestas que demuestran comprensión del concepto: CORRECTA
- Respuestas con ejemplos relevantes: CORRECTA
- Respuestas cortas pero coherentes y que responden la pregunta: CORRECTA
- Solo marcar como incorrecta si la respuesta es completamente irrelevante o sin sentido

RESPONDE ÚNICAMENTE con un JSON válido:
{
  "isCorrect": true/false,
  "explanation": "Breve explicación de por qué es correcta o incorrecta"
}`;

    const userPrompt = `Evalúa esta respuesta a una pregunta de QA:

PREGUNTA: ${questionText}
CATEGORÍA: ${category}
DIFICULTAD: ${difficulty}
RESPUESTA DEL USUARIO: ${userAnswer}

Determina si la respuesta es correcta basándote en los criterios establecidos.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages);
    
    try {
      return JSON.parse(response);
    } catch (error) {
      console.error('Failed to parse AI evaluation response as JSON:', response);
      // Fallback: mark as incorrect if parsing fails
      return { isCorrect: false, explanation: "Error evaluating response" };
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
${userResponses.map((resp, idx) => {
  const question = questions[idx];
  if (question?.type === 'multiple-choice') {
    return `
Pregunta ${idx + 1}: ${question.questionText}
Tipo: Opción múltiple
Opciones disponibles: ${question.options?.join(' | ') || 'No disponibles'}
Respuesta seleccionada: ${resp.userSelectedOption || 'No seleccionada'}
Respuesta correcta: ${question.correctAnswer}
Correcta: ${resp.isCorrect ? 'Sí' : 'No'}`;
  } else {
    return `
Pregunta ${idx + 1}: ${question?.questionText}
Tipo: Pregunta abierta
Respuesta del usuario: ${resp.response}
Correcta: ${resp.isCorrect ? 'Sí' : 'No'}`;
  }
}).join('\n')}

Genera feedback constructivo y personalizado basado en el análisis detallado de cada respuesta.`;

    const messages: OpenRouterMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];

    const response = await this.generateCompletion(messages);
    
    try {
      // Clean the response to remove any potential formatting issues
      let cleanedResponse = response.trim();
      
      // Remove any markdown code blocks if present
      if (cleanedResponse.startsWith('```json')) {
        cleanedResponse = cleanedResponse.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedResponse.startsWith('```')) {
        cleanedResponse = cleanedResponse.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }
      
      console.log('Cleaned response for parsing:', cleanedResponse);
      
      let parsedResponse;
      try {
        parsedResponse = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.log('Initial parse failed, trying to fix control characters...');
        
        // Try to fix control characters by replacing them with spaces in string values
        const fixedResponse = cleanedResponse.replace(/"([^"]*?)"/g, (match, content) => {
          // Replace control characters in string content with spaces
          const fixedContent = content
            .replace(/\n/g, ' ')
            .replace(/\r/g, ' ')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' '); // Replace multiple spaces with single space
          return `"${fixedContent}"`;
        });
        
        console.log('Fixed response for parsing:', fixedResponse);
        parsedResponse = JSON.parse(fixedResponse);
      }
      
      // Validate the required fields
      if (!parsedResponse.strengths || !parsedResponse.improvements || 
          !parsedResponse.nextSteps || !parsedResponse.detailedFeedback || 
          !parsedResponse.badge) {
        throw new Error('Missing required fields in feedback response');
      }
      
      return parsedResponse;
    } catch (error) {
      console.error('Failed to parse feedback response as JSON:', response);
      console.error('Parse error:', error);
      
      // Return a fallback response instead of throwing
      return {
        strengths: ["Comprensión básica del tema evaluado"],
        improvements: ["Necesita más práctica y estudio"],
        nextSteps: "Continúa estudiando y practicando los conceptos evaluados",
        detailedFeedback: "El usuario mostró un desempeño básico en la evaluación. Se recomienda más estudio y práctica.",
        badge: "QA Novice"
      };
    }
  }

  async generateStageDetails(
    stageTitle: string,
    stageDescription: string,
    difficulty: string,
    considerations?: string
  ): Promise<{
    topicsCovered: string[];
    whatToExpect: string;
    tipsForSuccess: string[];
    evaluationDescription: string;
  }> {
    const prompt = `Eres un experto en Quality Assurance y evaluación de conocimientos. 
    
Basándote en el siguiente stage de evaluación, genera información detallada y útil:

TÍTULO: ${stageTitle}
DESCRIPCIÓN: ${stageDescription}
DIFICULTAD: ${difficulty}
${considerations ? `CONSIDERACIONES: ${considerations}` : ''}

Genera la siguiente información en formato JSON:

1. "topicsCovered": Array de 3-5 temas principales que se cubrirán en esta evaluación
2. "whatToExpect": Descripción clara de qué esperar en la evaluación (formato, tipos de preguntas, duración)
3. "tipsForSuccess": Array de 4-5 consejos prácticos para tener éxito en esta evaluación
4. "evaluationDescription": Descripción motivacional y profesional de la evaluación

Responde SOLO con el JSON válido, sin texto adicional.`;

    try {
      const response = await this.generateCompletion([{ role: 'user', content: prompt }]);
      const parsedResponse = JSON.parse(response);
      
      return {
        topicsCovered: parsedResponse.topicsCovered || [],
        whatToExpect: parsedResponse.whatToExpect || '',
        tipsForSuccess: parsedResponse.tipsForSuccess || [],
        evaluationDescription: parsedResponse.evaluationDescription || ''
      };
    } catch (error) {
      console.error('Error generating stage details:', error);
      // Fallback response
      return {
        topicsCovered: ['Fundamentos básicos', 'Conceptos clave', 'Aplicación práctica'],
        whatToExpect: 'Esta evaluación incluye preguntas de opción múltiple y preguntas abiertas diseñadas para evaluar tu comprensión del tema.',
        tipsForSuccess: [
          'Lee cada pregunta cuidadosamente',
          'Toma notas si es necesario',
          'Revisa tus respuestas antes de enviar',
          'No te apresures, tienes tiempo suficiente'
        ],
        evaluationDescription: 'Esta evaluación está diseñada para medir tu comprensión y aplicación de los conceptos clave del tema.'
      };
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
