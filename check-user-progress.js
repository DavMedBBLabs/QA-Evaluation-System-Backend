const { AppDataSource } = require('./src/config/database');
const { User } = require('./src/entities/User');
const { UserStage } = require('./src/entities/UserStage');
const { Stage } = require('./src/entities/Stage');

async function checkUserProgress() {
  try {
    await AppDataSource.initialize();
    console.log('Database connected');

    // Get user by email (replace with actual user email)
    const userEmail = 'diego@test.com'; // Replace with actual user email
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({
      where: { email: userEmail },
      relations: ['userStages', 'userStages.stage']
    });

    if (!user) {
      console.log('User not found');
      return;
    }

    console.log('\n=== USER INFO ===');
    console.log(`User: ${user.firstName} ${user.lastName}`);
    console.log(`Email: ${user.email}`);
    console.log(`Global Score: ${user.globalScore}`);
    console.log(`Current Stage ID: ${user.currentStageId}`);

    console.log('\n=== USER STAGES ===');
    for (const userStage of user.userStages) {
      console.log(`Stage: ${userStage.stage.title}`);
      console.log(`  - Stage ID: ${userStage.stageId}`);
      console.log(`  - Score: ${userStage.score}`);
      console.log(`  - Is Completed: ${userStage.isCompleted}`);
      console.log(`  - Completed At: ${userStage.completedAt}`);
      console.log('  ---');
    }

    // Get all stages
    const stageRepository = AppDataSource.getRepository(Stage);
    const allStages = await stageRepository.find({
      where: { isActive: true },
      order: { displayOrder: 'ASC' }
    });

    console.log('\n=== ALL STAGES ===');
    for (const stage of allStages) {
      const userStage = user.userStages.find(us => us.stageId === stage.id);
      console.log(`Stage: ${stage.title} (ID: ${stage.id}, Order: ${stage.displayOrder})`);
      if (userStage) {
        console.log(`  - User Score: ${userStage.score}`);
        console.log(`  - Is Completed: ${userStage.isCompleted}`);
        console.log(`  - Completed At: ${userStage.completedAt}`);
      } else {
        console.log(`  - No user stage record found`);
      }
      console.log('  ---');
    }

    await AppDataSource.destroy();
  } catch (error) {
    console.error('Error:', error);
  }
}

checkUserProgress(); 