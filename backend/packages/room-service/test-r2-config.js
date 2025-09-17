/**
 * Test script for Cloudflare R2 configuration
 * Run this script to verify your R2 setup is working correctly
 */

import {
  checkR2Config,
  uploadFile,
  listFiles,
} from './src/services/cloudflareR2Service.js';

async function testR2Configuration() {
  console.log('🧪 Testing Cloudflare R2 Configuration...\n');

  // Test 1: Check configuration
  console.log('1. Checking R2 configuration...');
  const isConfigured = checkR2Config();
  console.log(
    `   Configuration status: ${isConfigured ? '✅ Valid' : '❌ Invalid'}`
  );

  if (!isConfigured) {
    console.log(
      '\n❌ R2 configuration is invalid. Please check your environment variables:'
    );
    console.log('   - CLOUDFLARE_R2_ACCOUNT_ID');
    console.log('   - CLOUDFLARE_R2_ACCESS_KEY_ID');
    console.log('   - CLOUDFLARE_R2_SECRET_ACCESS_KEY');
    console.log('   - CLOUDFLARE_R2_BUCKET_NAME');
    return;
  }

  // Test 2: Test file upload
  console.log('\n2. Testing file upload...');
  try {
    const testContent = 'This is a test file for MiniMeet R2 configuration.';
    const testBuffer = Buffer.from(testContent, 'utf8');

    const uploadResult = await uploadFile(testBuffer, {
      fileName: 'test-config.txt',
      organizationId: 'test-org',
      recordingId: 'test-recording',
      fileFormat: 'txt',
      contentType: 'text/plain',
      folder: 'test',
    });

    console.log('   ✅ File upload successful');
    console.log(`   File key: ${uploadResult.key}`);
    console.log(`   File size: ${uploadResult.fileSize} bytes`);

    // Test 3: Test file listing
    console.log('\n3. Testing file listing...');
    const listResult = await listFiles('test/');
    console.log(`   ✅ Found ${listResult.count} files in test folder`);

    console.log(
      '\n🎉 All tests passed! R2 configuration is working correctly.'
    );
  } catch (error) {
    console.log(`   ❌ Test failed: ${error.message}`);
    console.log('\nPlease check your R2 credentials and bucket permissions.');
  }
}

// Run the test
testR2Configuration().catch(console.error);
