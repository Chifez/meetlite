import { spawn } from 'child_process';
import crypto from 'crypto';
import { CheckResult, CheckStatus } from './types.js';

export interface RunnerOptions {
  timeoutMs?: number;
  cwd?: string;
  commandMap?: Record<string, string>;
}

const DEFAULT_COMMAND_MAP: Record<string, string> = {
  'format:check': 'npm run format:check',
  lint: 'npm run lint',
  'typecheck:all': 'npm run typecheck:all',
  'test:unit': 'npm run test:unit',
  'test:integration': 'npm run test:integration',
  'test:contracts': 'npm run test:contracts',
  'test:e2e': 'npm run test:e2e',
};

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function parseTestCount(output: string): number | undefined {
  // Matches "tests <N>" or "ℹ tests <N>" or "<N> passing"
  const nodeMatch = output.match(/(?:ℹ\s+)?tests\s+(\d+)/i);
  if (nodeMatch) return parseInt(nodeMatch[1], 10);

  const passingMatch = output.match(/(\d+)\s+(?:passing|passed)/i);
  if (passingMatch) return parseInt(passingMatch[1], 10);

  return undefined;
}

export class CheckRunner {
  private timeoutMs: number;
  private cwd: string;
  private commandMap: Record<string, string>;

  constructor(options: RunnerOptions = {}) {
    this.timeoutMs = options.timeoutMs || 180000; // 3 minutes default
    this.cwd = options.cwd || process.cwd();
    this.commandMap = { ...DEFAULT_COMMAND_MAP, ...(options.commandMap || {}) };
  }

  async runCheck(checkName: string): Promise<CheckResult> {
    const command = this.commandMap[checkName] || checkName;
    const startTime = Date.now();

    return new Promise((resolve) => {
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const proc = spawn('sh', ['-c', command], {
        cwd: this.cwd,
        env: { ...process.env, CI: 'true' },
      });

      const timer = setTimeout(() => {
        timedOut = true;
        proc.kill('SIGTERM');
        setTimeout(() => proc.kill('SIGKILL'), 2000);
      }, this.timeoutMs);

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code, signal) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        const exitCode = code !== null ? code : signal ? 128 : 1;
        const combinedOutput = stdout + '\n' + stderr;
        const testCount = parseTestCount(combinedOutput);

        let status: CheckStatus = 'PASS';
        let failureReason: string | undefined = undefined;
        let zeroTestDetected = false;

        if (timedOut) {
          status = 'INFRA_ERROR';
          failureReason = `CHECK_TIMED_OUT: execution exceeded ${this.timeoutMs}ms limit`;
        } else if (combinedOutput.includes('NOT_IMPLEMENTED')) {
          status = 'NOT_IMPLEMENTED';
          failureReason = `NOT_IMPLEMENTED: suite or harness is scheduled for a future phase`;
        } else if (exitCode !== 0) {
          status = 'FAIL';
          failureReason = `COMMAND_FAILED: process exited with code ${exitCode}`;
        } else {
          // Check for zero-test false positives on test commands
          if (checkName.startsWith('test:') || command.includes('--test')) {
            if (testCount === 0) {
              zeroTestDetected = true;
              status = 'FAIL';
              failureReason = `ZERO_TESTS_DISCOVERED: test command passed with 0 executed tests`;
            }
          }
        }

        resolve({
          name: checkName,
          command,
          status,
          durationMs,
          exitCode,
          testCount,
          zeroTestDetected,
          timedOut,
          failureReason,
          stdoutDigest: sha256(stdout),
          stderrDigest: sha256(stderr),
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        const durationMs = Date.now() - startTime;
        resolve({
          name: checkName,
          command,
          status: 'INFRA_ERROR',
          durationMs,
          exitCode: 1,
          zeroTestDetected: false,
          timedOut: false,
          failureReason: `SPAWN_ERROR: ${err.message}`,
          stdoutDigest: sha256(stdout),
          stderrDigest: sha256(stderr),
        });
      });
    });
  }

  async runAll(checks: string[]): Promise<CheckResult[]> {
    const results: CheckResult[] = [];
    for (const check of checks) {
      const result = await this.runCheck(check);
      results.push(result);
      // Fail-fast on hard test failures if needed, but run all to report comprehensive state
    }
    return results;
  }
}
