const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const createAppSource = fs.readFileSync(path.join(root, 'src/app/createApp.js'), 'utf8');
const redisSource = fs.readFileSync(path.join(root, 'src/config/redis.js'), 'utf8');
const rateLimitersSource = fs.readFileSync(path.join(root, 'src/middleware/rateLimiters.js'), 'utf8');
const idempotencySource = fs.readFileSync(path.join(root, 'src/middleware/idempotency.middleware.js'), 'utf8');
const findWorkspacePageSource = fs.readFileSync(path.join(root, 'ui/src/pages/FindWorkspacePage.jsx'), 'utf8');

// 1. Redis retryStrategy must not return null in production
assert.ok(!redisSource.includes('if (isProduction()) return null;'), 'retryStrategy must not return null in production, which permanently bricks Redis on socket close.');
assert.ok(redisSource.includes('return Math.min(times * 100, 2000);'), 'retryStrategy must reconnect with backoff in production.');

// 2. Rate limiters passOnStoreError must be set for graceful fallback
assert.ok(rateLimitersSource.includes('passOnStoreError: !failClosedWhenRedisUnavailable'), 'Rate limiters must pass on store errors when failClosedWhenRedisUnavailable is false.');
assert.ok(rateLimitersSource.includes('if (!isRedisReady())'), 'Rate limiter sendCommand must check isRedisReady to avoid calling closed Redis instances.');

// 3. Idempotency middleware must honor ALLOW_REDIS_FALLBACK in production
assert.ok(idempotencySource.includes('isRedisFallbackAllowed()'), 'Idempotency middleware must check isRedisFallbackAllowed().');
assert.ok(idempotencySource.includes('!isRedisFallbackAllowed()'), 'Idempotency middleware must allow fallback when ALLOW_REDIS_FALLBACK=true in production.');

// 4. writeGuardChain must exempt non-mutating /find-workspace
assert.ok(createAppSource.includes('nonMutatingPostPaths'), 'writeGuardChain must define nonMutatingPostPaths.');
assert.ok(createAppSource.includes('isNonMutatingPost'), 'writeGuardChain must bypass idempotency and invariant guards for non-mutating POST endpoints like find-workspace.');

// 5. FindWorkspacePage must check lookupError.status properly
assert.ok(findWorkspacePageSource.includes('lookupError?.status ?? lookupError?.response?.status'), 'FindWorkspacePage must inspect lookupError.status.');

console.log('findWorkspaceReliability.test.js passed');
