import { validateStripeConfig, stripeConfig } from './src/config/stripe.js';

/**
 * Stripe Configuration Validator
 *
 * This script helps you validate that all required Stripe environment variables
 * are properly configured before starting the server.
 */

console.log('🔍 Validating Stripe Configuration...\n');

const validation = validateStripeConfig();

if (validation.isValid) {
  console.log('✅ All Stripe configuration is valid!');
  console.log('\n📋 Current Configuration:');
  console.log(
    `- Secret Key: ${stripeConfig.secretKey ? '✅ Set' : '❌ Missing'}`
  );
  console.log(
    `- Webhook Secret: ${stripeConfig.webhookSecret ? '✅ Set' : '❌ Missing'}`
  );

  console.log('\n💰 Price IDs:');
  Object.entries(stripeConfig.priceIds).forEach(([planType, durations]) => {
    console.log(`  ${planType.toUpperCase()}:`);
    Object.entries(durations).forEach(([duration, priceId]) => {
      console.log(`    ${duration}: ${priceId ? '✅ Set' : '❌ Missing'}`);
    });
  });

  console.log('\n🚀 Ready to process payments!');
} else {
  console.log('❌ Stripe configuration is incomplete!');
  console.log('\n🔧 Missing environment variables:');
  validation.missing.forEach((field) => {
    console.log(`  - ${field}`);
  });

  console.log('\n📝 To fix this:');
  console.log('1. Go to https://dashboard.stripe.com/');
  console.log('2. Create products and prices for your plans');
  console.log('3. Copy the price IDs and add them to your .env file');
  console.log('4. Restart your server');

  process.exit(1);
}
