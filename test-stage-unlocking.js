// Test script to validate stage unlocking logic
const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

async function testStageUnlocking() {
  try {
    console.log('Testing stage unlocking logic...');
    
    // First, login to get a token
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'usuario@test.com',
      password: '12345678'
    });
    
    const token = loginResponse.data.token;
    const headers = { Authorization: `Bearer ${token}` };
    
    // Test the debug endpoint
    const debugResponse = await axios.get(`${BASE_URL}/stages/debug/unlocking`, { headers });
    const debugData = debugResponse.data;
    
    console.log('\n=== STAGE UNLOCKING DEBUG INFO ===');
    console.log(`User ID: ${debugData.userId}`);
    console.log(`Total Stages: ${debugData.totalStages}`);
    console.log(`Completed Stages: ${debugData.completedStages.join(', ')}`);
    console.log('\nStage Details:');
    
    debugData.stages.forEach(stage => {
      const status = stage.isUnlocked ? '🔓 UNLOCKED' : '🔒 LOCKED';
      const completed = stage.isCompleted ? '✅ COMPLETED' : '⏳ PENDING';
      console.log(`  ${stage.id}. ${stage.title} (Order: ${stage.displayOrder}) - ${status} | ${completed}`);
    });
    
    // Validate logic
    console.log('\n=== VALIDATION ===');
    const firstStage = debugData.stages.find(s => s.displayOrder === 1);
    if (firstStage && !firstStage.isUnlocked) {
      console.log('❌ ERROR: First stage should always be unlocked!');
    } else if (firstStage) {
      console.log('✅ First stage is correctly unlocked');
    }
    
    // Check if there are any gaps in displayOrder
    const displayOrders = debugData.stages.map(s => s.displayOrder).sort((a, b) => a - b);
    const expectedOrders = Array.from({length: displayOrders.length}, (_, i) => i + 1);
    const hasGaps = displayOrders.some((order, index) => order !== expectedOrders[index]);
    
    if (hasGaps) {
      console.log('⚠️  WARNING: There are gaps in displayOrder');
    } else {
      console.log('✅ DisplayOrder is sequential');
    }
    
    console.log('\n=== END TEST ===');
    
  } catch (error) {
    console.error('Test failed:', error.response?.data || error.message);
  }
}

testStageUnlocking(); 