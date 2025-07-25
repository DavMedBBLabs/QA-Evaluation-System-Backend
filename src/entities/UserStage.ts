import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { User } from './User';
import { Stage } from './Stage';

@Entity('user_stages')
@Unique(['userId', 'stageId'])
export class UserStage {
  @PrimaryGeneratedColumn()
  id: number = 0;

  @Column({ name: 'user_id', type: 'integer' })
  userId: number = 0;

  @Column({ name: 'stage_id', type: 'integer' })
  stageId: number = 0;

  @Column({ name: 'is_completed', type: 'boolean', default: false })
  isCompleted: boolean = false;

  @Column({ type: 'integer', nullable: true })
  score: number | null = null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null = null;

  @ManyToOne(() => User, user => user.userStages)
  @JoinColumn({ name: 'user_id' })
  user: User = new User();

  @ManyToOne(() => Stage, stage => stage.userStages)
  @JoinColumn({ name: 'stage_id' })
  stage: Stage = new Stage();
}
