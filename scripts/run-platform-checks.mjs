import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: repoRoot, stdio: 'inherit', shell: false });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`));
    });
  });
}

try {
  await run(process.execPath, ['scripts/validate-v2-fixtures.mjs']);
  await run(process.execPath, ['--test', 'tests/platform/v2-fixtures.test.mjs']);
  console.log('CarbonBridge platform checks passed.');
} catch (error) {
  console.error(`Platform checks failed: ${error.message}`);
  process.exitCode = 1;
}
