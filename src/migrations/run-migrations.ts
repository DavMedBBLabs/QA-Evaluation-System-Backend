import { getDataSource } from '../config/database';
import { Stage } from '../entities/Stage';

async function runMigrations() {
  try {
    // Get initialized data source
    const dataSource = await getDataSource();
    console.log('Database connected successfully');

    // Insert initial stages
    const stageRepository = dataSource.getRepository(Stage);
    
    const initialStages = [
      {
        title: 'Fundamentos de QA',
        description: 'Conceptos básicos de testing y quality assurance',
        difficulty: 'Beginner',
        icon: 'BookOpen',
        color: '#10B981',
        estimatedTime: '30 min',
        displayOrder: 1,
        isActive: true,
        questionCount: 0
      },
      {
        title: 'Tipos de Testing',
        description: 'Testing funcional, no funcional, manual y automatizado',
        difficulty: 'Beginner',
        icon: 'Settings',
        color: '#3B82F6',
        estimatedTime: '45 min',
        displayOrder: 2,
        isActive: true,
        questionCount: 0
      },
      {
        title: 'Metodologías de Testing',
        description: 'Waterfall, Agile, Scrum y metodologías modernas',
        difficulty: 'Intermediate',
        icon: 'Workflow',
        color: '#8B5CF6',
        estimatedTime: '40 min',
        displayOrder: 3,
        isActive: true,
        questionCount: 0
      },
      {
        title: 'Herramientas de Testing',
        description: 'Selenium, Cypress, Postman y herramientas modernas',
        difficulty: 'Intermediate', 
        icon: 'Tool',
        color: '#F59E0B',
        estimatedTime: '50 min',
        displayOrder: 4,
        isActive: true,
        questionCount: 0
      },
      {
        title: 'Testing Avanzado',
        description: 'Performance, security, API testing avanzado',
        difficulty: 'Advanced',
        icon: 'Zap',
        color: '#EF4444',
        estimatedTime: '60 min',
        displayOrder: 5,
        isActive: true,
        questionCount: 0
      }
    ];

    for (const stageData of initialStages) {
      const existingStage = await stageRepository.findOne({
        where: { title: stageData.title }
      });

      if (!existingStage) {
        const stage = stageRepository.create(stageData);
        await stageRepository.save(stage);
        console.log(`Created stage: ${stageData.title}`);
      }
    }

    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Error running migrations:', error);
    process.exit(1);
  } finally {
    // No need to destroy the connection as it's managed by the DataSource singleton
    console.log('Migrations process completed');
  }
}

// Run migrations if this file is executed directly
if (require.main === module) {
  runMigrations().catch(console.error);
}
