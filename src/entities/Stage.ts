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
  isActive: boolean;
  considerations?: string | null;
  topicsCovered?: string[] | null;
  whatToExpect?: string | null;
  tipsForSuccess?: string[] | null;
  evaluationDescription?: string | null;
  totalQuestions?: number;
  openQuestions?: number;
  closedQuestions?: number;
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

  @Column({ type: 'text', nullable: true })
  considerations: string | null = null;

  @Column({ type: 'text', array: true, nullable: true })
  topicsCovered: string[] | null = null;

  @Column({ type: 'text', nullable: true })
  whatToExpect: string | null = null;

  @Column({ type: 'text', array: true, nullable: true })
  tipsForSuccess: string[] | null = null;

  @Column({ type: 'text', nullable: true })
  evaluationDescription: string | null = null;

  @Column({ name: 'total_questions', type: 'integer', default: 10 })
  totalQuestions: number = 10;

  @Column({ name: 'open_questions', type: 'integer', default: 5 })
  openQuestions: number = 5;

  @Column({ name: 'closed_questions', type: 'integer', default: 5 })
  closedQuestions: number = 5;

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
    stage.isActive = stageData.isActive;
    stage.questionCount = 0; // Initialize with 0 questions
    stage.considerations = stageData.considerations || null;
    stage.topicsCovered = stageData.topicsCovered || null;
    stage.whatToExpect = stageData.whatToExpect || null;
    stage.tipsForSuccess = stageData.tipsForSuccess || null;
    stage.evaluationDescription = stageData.evaluationDescription || null;
    stage.totalQuestions = stageData.totalQuestions || 10;
    stage.openQuestions = stageData.openQuestions || 5;
    stage.closedQuestions = stageData.closedQuestions || 5;

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
