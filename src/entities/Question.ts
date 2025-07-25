import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn, OneToMany } from 'typeorm';
import { Stage } from './Stage';
import { UserResponse } from './UserResponse';

@Entity('questions')
export class Question {
  @PrimaryGeneratedColumn()
  id: number = 0;

  @Column({ name: 'stage_id', type: 'integer' })
  stageId: number = 0;

  @Column({ type: 'varchar' })
  type: string = '';

  @Column({ name: 'question_text', type: 'text' })
  questionText: string = '';

  @Column({ type: 'jsonb', nullable: true })
  options: string[] | null = [];

  @Column({ name: 'correct_answer', type: 'varchar', nullable: true })
  correctAnswer: string | null = '';

  @Column({ type: 'integer', default: 1 })
  points: number = 0;

  @Column({ type: 'varchar', nullable: true })
  category: string | null = '';

  @Column({ type: 'varchar', nullable: true })
  difficulty: string | null = '';

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date = new Date();

  @ManyToOne(() => Stage, stage => stage.questions)
  @JoinColumn({ name: 'stage_id' })
  stage: Stage = new Stage();

  @OneToMany(() => UserResponse, response => response.question)
  userResponses: UserResponse[];
}
