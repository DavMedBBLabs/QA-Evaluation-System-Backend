// Script to check which stages have questions
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function checkStagesAndQuestions() {
  try {
    console.log('Checking stages and questions...');
    
    // First, login to get a token
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'usuario@test.com',
      password: '12345678'
    });
    
    const token = loginResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    // Get all stages
    const stagesResponse = await axios.get(`${BASE_URL}/api/stages`, { headers });
    const stages = stagesResponse.data.stages;
    
    console.log('\n=== STAGES AND QUESTIONS STATUS ===');
    console.log(`Total stages: ${stages.length}`);
    
    for (const stage of stages) {
      console.log(`\nStage ${stage.id}: ${stage.title}`);
      console.log(`  - Display Order: ${stage.displayOrder}`);
      console.log(`  - Question Count: ${stage.questionCount}`);
      console.log(`  - Is Active: ${stage.isActive}`);
      
      // Try to generate questions for this stage
      try {
        const generateResponse = await axios.get(
          `${BASE_URL}/api/evaluations/generate?stage=${stage.id}&open=2&closed=2`, 
          { headers }
        );
        console.log(`  - Questions generated successfully: ${generateResponse.data.questions.length}`);
      } catch (error) {
        console.log(`  - Error generating questions: ${error.response?.data?.error || error.message}`);
      }
    }
    
    console.log('\n=== END CHECK ===');
    
  } catch (error) {
    console.error('Check failed:', error.response?.data || error.message);
  }
}

checkStagesAndQuestions(); 