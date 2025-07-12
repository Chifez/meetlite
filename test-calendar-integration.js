const axios = require('axios');

// Test configuration
const CALENDAR_URL = 'http://localhost:3002'; // Calendar Service URL
const TEST_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXIiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJpYXQiOjE2MzQ1NjgwMDAsImV4cCI6MTYzNDY1NDQwMH0.test-signature';

async function testCalendarIntegration() {
  console.log('🧪 Testing Calendar Integration\n');

  try {
    // Test 1: Check connected calendars
    console.log('📅 Test 1: Checking connected calendars...');
    const connectedResponse = await axios.get(
      `${CALENDAR_URL}/api/calendar/connected`,
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
        },
      }
    );

    console.log('✅ Connected calendars:', connectedResponse.data);
    const isGoogleConnected = connectedResponse.data.some(
      (cal) => cal.type === 'google' && cal.isConnected
    );
    console.log('🔗 Google Calendar connected:', isGoogleConnected);

    // Test 2: Check conflicts (should work even without calendar connected)
    console.log('\n🔍 Test 2: Checking calendar conflicts...');
    const now = new Date();
    const startDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Tomorrow
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // 1 hour later

    const conflictResponse = await axios.post(
      `${CALENDAR_URL}/api/calendar/conflicts`,
      {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        attendees: ['test@example.com'],
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('✅ Conflict check result:', conflictResponse.data);
    console.log('⚠️ Conflicts found:', conflictResponse.data.conflicts.length);
    console.log(
      '🕐 Available slots:',
      conflictResponse.data.availableSlots.length
    );

    // Test 3: Test with a time that might have conflicts
    console.log('\n🔍 Test 3: Testing with specific time range...');
    const testStart = new Date('2024-01-16T09:00:00Z');
    const testEnd = new Date('2024-01-16T10:00:00Z');

    const specificConflictResponse = await axios.post(
      `${CALENDAR_URL}/api/calendar/conflicts`,
      {
        startDate: testStart.toISOString(),
        endDate: testEnd.toISOString(),
        attendees: ['test@example.com'],
      },
      {
        headers: {
          Authorization: `Bearer ${TEST_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(
      '✅ Specific conflict check result:',
      specificConflictResponse.data
    );
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }

  console.log('\n🎯 Calendar Integration Test Complete!');
  console.log('\n📋 What to check:');
  console.log('1. Calendar service is running on port 3002');
  console.log('2. Connected calendars endpoint returns proper data');
  console.log('3. Conflict checking works (even without connected calendar)');
  console.log('4. Available slots are generated correctly');
}

// Run the test
testCalendarIntegration().catch(console.error);
