// Child-process fault injector. Never imported by production source.
import { ReplayLedger } from '../src/replay-ledger.mjs';
import { readFileSync } from 'node:fs';
const payload = JSON.parse(readFileSync(new URL('./replay-input.json', import.meta.url), 'utf8'));

const [path, operation, fault = 'none'] = process.argv.slice(2);
const ledger = new ReplayLedger(path);
const checkpoint = phase => {
  if (phase === fault) process.exit(86); // No close or JS rollback on purpose.
};
if (process.send) {
  process.send('ready');
  await new Promise(resolve => process.once('message', resolve));
}
try {
  const result = operation === 'receive'
    ? ledger.receive(payload, checkpoint)
    : ledger.replay(checkpoint);
  console.log(JSON.stringify(result));
} finally {
  ledger.close();
}
