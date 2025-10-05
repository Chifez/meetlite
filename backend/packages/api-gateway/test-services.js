#!/usr/bin/env node

import axios from 'axios';

const services = [
  { name: 'Auth Service', url: 'http://localhost:5000' },
  { name: 'Room Service', url: 'http://localhost:5001' },
  { name: 'Signaling Service', url: 'http://localhost:5002' },
  { name: 'API Gateway', url: 'http://localhost:3000' },
];

async function testService(service) {
  try {
    console.log(`Testing ${service.name} at ${service.url}...`);

    const response = await axios.get(`${service.url}/health`, {
      timeout: 5000,
    });

    console.log(
      `✅ ${service.name}: ${response.status} - ${JSON.stringify(
        response.data
      )}`
    );
    return true;
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log(
        `❌ ${service.name}: Connection refused - service not running`
      );
    } else if (error.code === 'ECONNABORTED') {
      console.log(`❌ ${service.name}: Request timeout`);
    } else {
      console.log(`❌ ${service.name}: ${error.message}`);
    }
    return false;
  }
}

async function testAllServices() {
  console.log('🔍 Testing all services...\n');

  const results = await Promise.all(services.map(testService));

  const runningServices = results.filter(Boolean).length;
  const totalServices = services.length;

  console.log(
    `\n📊 Summary: ${runningServices}/${totalServices} services running`
  );

  if (runningServices < totalServices) {
    console.log('\n🚨 Some services are not running. Please start them:');
    services.forEach((service, index) => {
      if (!results[index]) {
        console.log(`   - ${service.name}: npm run dev`);
      }
    });
  } else {
    console.log('\n🎉 All services are running!');
  }
}

testAllServices().catch(console.error);
