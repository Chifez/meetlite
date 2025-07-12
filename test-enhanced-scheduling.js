const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3001'; // AI Service URL
const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MzQ1NjgwMDAsImV4cCI6MTYzNDY1NDQwMH0.test-signature';

// Test cases for enhanced smart scheduling
const testCases = [
  {
    name: 'Team standup tomorrow 9 AM',
    description: 'Basic meeting with relative date',
  },
  {
    name: 'Client call Friday 2 PM, invite john@company.com',
    description: 'Meeting with specific day and participant',
  },
  {
    name: 'Project review next Monday 3 PM',
    description: "Meeting with 'next' relative date",
  },
  {
    name: 'Daily sync today 10 AM',
    description: "Meeting with 'today'",
  },
  {
    name: 'Weekly planning Monday 11 AM',
    description: 'Meeting with day of week',
  },
];

async function testEnhancedSmartScheduling() {
  console.log('🧪 Testing Enhanced Smart Scheduling System\n');

  for (const testCase of testCases) {
    console.log(`📝 Test: ${testCase.description}`);
    console.log(`Input: "${testCase.name}"`);

    try {
      const response = await axios.post(
        `${BASE_URL}/api/ai/parse-meeting`,
        {
          input: testCase.name,
          timezone: 'America/New_York',
        },
        {
          headers: {
            Authorization: `Bearer ${TEST_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.success) {
        const parsedData = response.data.data;
        console.log('✅ Parsed successfully:');
        console.log(`   Title: ${parsedData.title}`);
        console.log(`   Date: ${parsedData.date}`);
        console.log(`   Time: ${parsedData.time}`);
        console.log(`   Duration: ${parsedData.duration} minutes`);
        console.log(`   Participants: ${parsedData.participants.join(', ')}`);
        console.log(
          `   Confidence: ${(parsedData.confidence * 100).toFixed(1)}%`
        );
      } else {
        console.log('❌ Failed to parse:', response.data.error);
      }
    } catch (error) {
      console.log('❌ Error:', error.response?.data?.error || error.message);
    }

    console.log(''); // Empty line for readability
  }

  console.log('🎯 Enhanced Smart Scheduling Test Complete!');
  console.log('\n📋 What to expect:');
  console.log('1. All test cases should parse successfully');
  console.log('2. Relative dates should be converted to actual dates');
  console.log('3. Times should be in 24-hour format');
  console.log('4. Participants should be extracted from input');
  console.log('5. Confidence scores should be reasonable (0.7-1.0)');
}

// Run the test
testEnhancedSmartScheduling().catch(console.error);
