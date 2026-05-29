import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHelmetOptions } from '../src/lib/security.js';

test('helmet CSP does not upgrade HTTP asset requests on the high-port deployment', () => {
  const options = buildHelmetOptions();

  assert.equal(options.contentSecurityPolicy.directives.upgradeInsecureRequests, null);
  assert.equal(options.strictTransportSecurity, false);
});
