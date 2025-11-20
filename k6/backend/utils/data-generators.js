/**
 * Test Data Generators
 * Generates realistic test data for all test scenarios
 *
 * Syntax explanation:
 * - Uses module-level counter to generate unique IDs
 * - Functions return objects with test data
 * - Uses Date.now() and Math.random() for uniqueness
 */

// Module-level counter
// let allows reassignment (counter will increment)
// This persists across function calls in the same test run
let counter = {
  user: 0, // User counter
  room: 0, // Room counter
  meeting: 0, // Meeting counter
  organization: 0, // Organization counter
};

/**
 * Generate user data
 * Creates unique user data for testing
 * @returns {Object} - User object with email, password, name
 *
 * Syntax explanation:
 * - counter.user++ increments counter, then uses it
 * - Date.now() returns current timestamp in milliseconds
 * - Math.floor(Math.random() * 10000) generates random number 0-9999
 * - Template literal constructs unique email
 */
export function generateUser() {
  // Increment user counter
  // ++ operator increments variable by 1
  // Returns value AFTER incrementing (post-increment)
  counter.user++;

  // Get current timestamp
  // Date.now() returns milliseconds since 1970-01-01
  const timestamp = Date.now();

  // Generate random number between 0 and 9999
  // Math.random() returns 0.0 to 0.999...
  // Multiply by 10000 to get 0.0 to 9999.999...
  // Math.floor() rounds down to whole number (0 to 9999)
  const random = Math.floor(Math.random() * 10000);

  // Return user object
  return {
    // Template literal constructs email with unique values
    // ${variable} inserts variable value into string
    email: `k6-test-user-${timestamp}-${random}@test.minimeet.com`,

    // Password with random number for uniqueness
    password: `TestPassword${random}!`,

    // Name with counter for readability
    name: `Test User ${counter.user}`,
  };
}

/**
 * Generate room data
 * Creates room configuration for testing
 * @param {Object} settings - Optional room settings to override defaults
 * @returns {Object} - Room object with settings
 *
 * Syntax explanation:
 * - settings = {} means optional parameter with default empty object
 * - ?? is nullish coalescing - uses default if value is null or undefined
 * - || is logical OR - uses default if value is falsy (null, undefined, false, 0, '')
 */
export function generateRoom(settings = {}) {
  counter.room++;
  const timestamp = Date.now();

  return {
    // Generate unique room ID
    roomId: `k6-test-room-${timestamp}-${counter.room}`,

    // Settings object with defaults
    settings: {
      // ?? operator: use default if value is null/undefined
      // || operator: use default if value is falsy (false, null, undefined, 0, '')
      allowCollaboration: settings.allowCollaboration ?? true,
      maxParticipants: settings.maxParticipants ?? 50,
      privacy: settings.privacy || 'public',

      // Spread operator: copy any additional settings from parameter
      ...settings,
    },
  };
}

/**
 * Generate meeting data
 * Creates meeting configuration for testing
 * @param {Object} overrides - Optional data to override defaults
 * @returns {Object} - Meeting object with dates and details
 *
 * Syntax explanation:
 * - Date manipulation for start/end times
 * - new Date() creates Date object
 * - setHours() modifies date
 * - toISOString() converts to ISO 8601 format string
 */
export function generateMeeting(overrides = {}) {
  counter.meeting++;
  const timestamp = Date.now();

  // Create start date (1 hour from now)
  // new Date() creates current date/time
  const startDate = new Date();
  // setHours() sets hour, minutes, seconds (all optional)
  // Current hour + 1 = 1 hour from now
  startDate.setHours(startDate.getHours() + 1);

  // Create end date (1 hour after start date)
  // new Date(startDate) creates copy of startDate
  const endDate = new Date(startDate);
  // Add 1 hour to end date
  endDate.setHours(endDate.getHours() + 1);

  // Return meeting object
  return {
    title: `K6 Test Meeting ${counter.meeting}`,
    description: `Performance test meeting ${counter.meeting}`,

    // toISOString() converts Date to ISO 8601 string format
    // Example: "2024-01-15T14:30:00.000Z"
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),

    privacy: 'public',

    // Spread operator: apply any overrides
    // If overrides has title, it will override default title
    ...overrides,
  };
}

/**
 * Generate organization data
 * Creates organization configuration for testing
 * @param {Object} overrides - Optional data to override defaults
 * @returns {Object} - Organization object
 */
export function generateOrganization(overrides = {}) {
  counter.organization++;
  const timestamp = Date.now();

  return {
    name: `K6 Test Organization ${counter.organization}`,
    description: `Performance test organization ${counter.organization}`,
    industry: 'Technology',
    size: '10-50',

    // Apply overrides
    ...overrides,
  };
}

/**
 * Generate collaboration data
 * Creates collaboration event data for testing
 * @returns {Object} - Collaboration data object
 *
 * Syntax explanation:
 * - Arrays of possible values
 * - Math.floor(Math.random() * array.length) generates random index
 * - array[index] accesses array element
 */
export function generateCollaborationData() {
  // Array of collaboration tools
  const tools = ['whiteboard', 'document', 'presentation'];
  const actions = ['create', 'update', 'delete', 'draw', 'type'];

  return {
    // Select random tool from array
    // Math.random() * tools.length gives 0.0 to (length-1).999...
    // Math.floor() rounds down to integer index
    tool: tools[Math.floor(Math.random() * tools.length)],

    // Select random action
    action: actions[Math.floor(Math.random() * actions.length)],

    // Current timestamp in ISO format
    timestamp: new Date().toISOString(),

    // Random coordinate data
    data: {
      // Math.random() * 100 gives 0.0 to 99.999...
      x: Math.random() * 100,
      y: Math.random() * 100,
      value: `Test collaboration data ${Date.now()}`,
    },
  };
}

/**
 * Generate media state data
 * Creates media state (audio/video on/off) for testing
 * @returns {Object} - Media state object
 *
 * Syntax explanation:
 * - Math.random() > 0.5 returns boolean (true/false)
 * - 50% chance of being true (random probability)
 */
export function generateMediaState() {
  return {
    // Math.random() > 0.5 gives ~50% chance of true
    audio: Math.random() > 0.5,
    video: Math.random() > 0.5,
    // Math.random() > 0.8 gives ~20% chance of true (less common)
    screenShare: Math.random() > 0.8,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Generate calendar event data
 * Creates calendar event for testing
 * @returns {Object} - Calendar event object
 */
export function generateCalendarEvent() {
  const startDate = new Date();
  startDate.setHours(startDate.getHours() + 1);
  const endDate = new Date(startDate);
  endDate.setHours(endDate.getHours() + 1);

  return {
    title: `Test Calendar Event ${Date.now()}`,
    description: 'Test event description',
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    attendees: [], // Empty array, can add emails later
    location: 'Virtual',
  };
}
