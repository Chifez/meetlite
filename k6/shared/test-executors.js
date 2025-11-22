/**
 * Test Type Executors
 * Helper functions to apply test type configurations to test scenarios
 *
 * This module bridges the gap between test type definitions and actual test files
 */

// Import test type configurations
import { getTestType } from '../config/test-types.js';

/**
 * Create test options with test type applied
 * Main function used in test files to apply test type configuration
 *
 * @param {string} testType - Test type name ('load', 'stress', 'spike', etc.)
 * @param {Object} customOptions - Optional custom options to override defaults
 * @returns {Object} - Complete k6 options object with stages and thresholds
 *
 * Syntax explanation:
 * - customOptions = {} means optional parameter with default empty object
 * - This allows calling without options: createTestOptions('load')
 * - Or with options: createTestOptions('load', { thresholds: {...} })
 */
export function createTestOptions(testType, customOptions = {}) {
  // Get test type configuration
  // getTestType() returns the config object for the specified type
  const typeConfig = getTestType(testType);

  // Return k6 options object
  return {
    // Use custom stages if provided, otherwise use test type default
    // || operator: if customOptions.stages exists and is truthy, use it
    // Otherwise, use typeConfig.stages as fallback
    stages: customOptions.stages || typeConfig.stages,

    // Merge thresholds: test type defaults + custom overrides
    // Spread operator copies all properties
    // Later properties override earlier ones
    thresholds: {
      ...typeConfig.thresholds, // Start with test type default thresholds
      ...customOptions.thresholds, // Override with custom thresholds
    },

    // Include any other custom options (tags, summary, etc.)
    // Spread operator copies all other properties from customOptions
    // This allows passing additional k6 options like tags, summary, etc.
    ...customOptions,
  };
}

/**
 * Get test type description
 * Returns human-readable description of test type
 *
 * @param {string} testType - Test type name
 * @returns {string} - Description string
 *
 * Syntax explanation:
 * - Simple getter function
 * - getTestType() returns config object
 * - .description accesses the description property
 */
export function getTestTypeDescription(testType) {
  const typeConfig = getTestType(testType);
  return typeConfig.description;
}

/**
 * Get test type stages
 * Returns just the stages configuration for a test type
 *
 * @param {string} testType - Test type name
 * @returns {Array} - Array of stage objects
 *
 * Syntax explanation:
 * - Useful when you want just the stages, not full options
 * - .stages accesses stages array from config
 */
export function getTestTypeStages(testType) {
  const typeConfig = getTestType(testType);
  return typeConfig.stages;
}

/**
 * Get test type thresholds
 * Returns just the thresholds configuration for a test type
 *
 * @param {string} testType - Test type name
 * @returns {Object} - Thresholds object
 */
export function getTestTypeThresholds(testType) {
  const typeConfig = getTestType(testType);
  return typeConfig.thresholds;
}
