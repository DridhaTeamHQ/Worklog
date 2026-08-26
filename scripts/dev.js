/**
 * Runs the API and the Vite dev server together with prefixed, colourised output.
 * Either process exiting brings the other down, so Ctrl+C always leaves a clean slate.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const targets = [
  { name: 'api', color: '\x1b[36m', args: ['--prefix', 'backend', 'run', 'dev'] },
  { name: 'web', color: '\x1b[35m', args: ['--prefix', 'frontend', 'run', 'dev'] },
];

const children = [];
let shuttingDown = false;

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

for (const target of targets) {
  const child = spawn(npm, target.args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  children.push(child);

  const prefix = `${target.color}[${target.name}]\x1b[0m`;
  const write = (stream) => (chunk) => {
    for (const line of chunk.toString().split(/\r?\n/)) {
      if (line.trim()) stream.write(`${prefix} ${line}\n`);
    }
  };
  child.stdout.on('data', write(process.stdout));
  child.stderr.on('data', write(process.stderr));
  child.on('exit', (code) => {
    if (!shuttingDown) {
      console.log(`${prefix} exited with code ${code} — stopping the other process.`);
      shutdown(code ?? 0);
    }
  });
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
