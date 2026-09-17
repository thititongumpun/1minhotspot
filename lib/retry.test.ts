// Self-check: pnpm exec tsx lib/retry.test.ts. Exits 0 when green. No network.
import assert from "node:assert/strict";
import { retryUntil } from "./retry";

async function main() {
  // null means "not yet, try again"; the first non-null wins.
  let calls = 0;
  const flaky = async () => (++calls < 3 ? null : "still");
  assert.equal(await retryUntil(flaky, 4, 0), "still", "must return the first non-null result");
  assert.equal(calls, 3, "must stop as soon as a result lands");
  calls = 0;
  assert.equal(await retryUntil(flaky, 2, 0), null, "must give up after `attempts` tries");
  assert.equal(calls, 2);
  assert.equal(await retryUntil(async () => false, 3, 0), false, "false is a result, not a retry");
  console.log("ok  retryUntil: retries on null, stops on the first value, gives up after N attempts");
}

main();
