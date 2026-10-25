import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isOriginAllowed, parseAllowedOrigins } from './cors.js';

describe('parseAllowedOrigins', () => {
  it('turns a comma-separated setting into individual Socket.IO origins', () => {
    assert.deepEqual(
      parseAllowedOrigins(
        'http://localhost:5175, http://localhost:5174,http://localhost:3000'
      ),
      [
        'http://localhost:5175',
        'http://localhost:5174',
        'http://localhost:3000',
      ]
    );
  });

  it('removes empty and duplicate origins', () => {
    assert.deepEqual(
      parseAllowedOrigins(
        'http://localhost:5175,,http://localhost:5175,  '
      ),
      ['http://localhost:5175']
    );
  });

  it('does not authorize unlisted localhost ports', () => {
    const allowedOrigins = parseAllowedOrigins(
      'http://localhost:5175,http://localhost:5174'
    );

    assert.equal(isOriginAllowed('http://localhost:5175', allowedOrigins), true);
    assert.equal(isOriginAllowed('http://localhost:9999', allowedOrigins), false);
    assert.equal(isOriginAllowed('https://attacker.example', allowedOrigins), false);
    assert.equal(isOriginAllowed(undefined, allowedOrigins), true);
  });
});
