import { Entity, PrimaryGeneratedColumn, Column, OneToMany, Repository } from 'typeorm';
import { AppDataSource } from '../config/database';
import { Question } from './Question';
import { UserStage } from './UserStage';
import { EvaluationAttempt } from './EvaluationAttempt';

export interface ICreateStageInput {
  title: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  icon: string;
  color: string;
  estimatedTime: string;
  displayOrder: number;
  isActive?: boolean;
}

@Entity('stages')
export class Stage {
  @PrimaryGeneratedColumn()
  id: number = 0;

  @Column({ type: 'varchar' })
  title: string = '';

  @Column({ type: 'text', nullable: true })
  description: string | null = '';

  @Column({ type: 'varchar' })
  difficulty: string = '';

  @Column({ type: 'varchar', nullable: true })
  icon: string | null = '';

  @Column({ type: 'varchar', nullable: true })
  color: string | null = '';

  @Column({ name: 'estimated_time', type: 'varchar', nullable: true })
  estimatedTime: string | null = '';

  @Column({ name: 'question_count', type: 'integer', default: 0 })
  questionCount: number = 0;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean = true;

  @Column({ name: 'display_order', type: 'integer' })
  displayOrder: number = 0;

  @OneToMany(() => Question, question => question.stage)
  questions: Question[];

  @OneToMany(() => UserStage, userStage => userStage.stage)
  userStages: UserStage[];

  @OneToMany(() => EvaluationAttempt, attempt => attempt.stage)
  evaluationAttempts: EvaluationAttempt[];

  /**
   * Creates a new stage in the database
   * @param stageData Object containing stage data
   * @returns The created stage
   */
  static async createStage(stageData: ICreateStageInput): Promise<Stage> {
    const stageRepository: Repository<Stage> = AppDataSource.getRepository(Stage);
    
    // Check if stage with same title already exists
    const existingStage = await stageRepository.findOne({ where: { title: stageData.title } });
    if (existingStage) {
      throw new Error('A stage with this title already exists');
    }

    // Create and save the new stage
    const stage = new Stage();
    stage.title = stageData.title;
    stage.description = stageData.description;
    stage.difficulty = stageData.difficulty;
    stage.icon = stageData.icon;
    stage.color = stageData.color;
    stage.estimatedTime = stageData.estimatedTime;
    stage.displayOrder = stageData.displayOrder;
    stage.isActive = stageData.isActive ?? true;
    stage.questionCount = 0; // Initialize with 0 questions

    try {
      await stageRepository.save(stage);
      return stage;
    } catch (error) {
      console.error('Error creating stage:', error);
      throw new Error('Failed to create stage in the database');
    }
  }

  /**
   * Gets all active stages ordered by displayOrder
   * @returns Array of active stages
   */
  static async getAllStages(): Promise<Stage[]> {
    const stageRepository = AppDataSource.getRepository(Stage);
    return stageRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' }
    });
  }

  /**
   * Gets a stage by ID
   * @param id Stage ID
   * @returns The stage or null if not found
   */
  static async getStageById(id: number): Promise<Stage | null> {
    const stageRepository = AppDataSource.getRepository(Stage);
    return stageRepository.findOne({ where: { id } });
  }
}
