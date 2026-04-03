const bcrypt = require('bcrypt');
const assert = require('assert');

const SALT_ROUNDS = 10;
const PASSWORD_HISTORY_LIMIT = 5;

async function benchmark() {
  const password = 'newPassword123!';
  const history = [];
  for (let i = 0; i < PASSWORD_HISTORY_LIMIT; i++) {
    const hash = await bcrypt.hash(`oldPassword${i}`, SALT_ROUNDS);
    history.push({ hash });
  }

  console.log(`Benchmarking with ${PASSWORD_HISTORY_LIMIT} password comparisons...`);

  // Sequential
  const startSequential = Date.now();
  let reusedSequential = false;
  for (const oldPassword of history) {
    const isReused = await bcrypt.compare(password, oldPassword.hash);
    if (isReused) {
      reusedSequential = true;
      break;
    }
  }
  const endSequential = Date.now();
  console.log(`Sequential time: ${endSequential - startSequential}ms`);

  // Concurrent
  const startConcurrent = Date.now();
  const results = await Promise.all(
    history.map(oldPassword => bcrypt.compare(password, oldPassword.hash))
  );
  const reusedConcurrent = results.some(result => result);
  const endConcurrent = Date.now();
  console.log(`Concurrent time: ${endConcurrent - startConcurrent}ms`);

  assert.strictEqual(reusedSequential, reusedConcurrent);
}

benchmark().catch(console.error);
