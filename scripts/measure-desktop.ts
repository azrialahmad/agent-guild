import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { setTimeout as delay } from 'node:timers/promises';

if (process.platform !== 'darwin')
  throw new Error('This resource benchmark currently targets macOS.');

interface ProcessSample {
  pid: number;
  parent: number;
  rssKiB: number;
  cpuSeconds: number;
}

function processTree(root: number): ProcessSample[] {
  const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss=,time='], { encoding: 'utf8' });
  const processes = rows
    .trim()
    .split('\n')
    .map((row) => {
      const [pid, parent, rss, time] = row.trim().split(/\s+/);
      return {
        pid: Number(pid),
        parent: Number(parent),
        rssKiB: Number(rss),
        cpuSeconds: time.split(':').reduce((sum, part) => sum * 60 + Number(part), 0),
      };
    });
  const ids = new Set([root]);
  let previousSize = 0;
  while (previousSize !== ids.size) {
    previousSize = ids.size;
    for (const process of processes) if (ids.has(process.parent)) ids.add(process.pid);
  }
  return processes.filter((process) => ids.has(process.pid));
}

const executable =
  process.env.AGENT_GUILD_EXECUTABLE ?? (createRequire(import.meta.url)('electron') as string);
console.log(
  JSON.stringify({
    platform: process.platform,
    architecture: process.arch,
    samplesPerScenario: 10,
    sampleIntervalMs: 1000,
    mode: 'synthetic-demo',
    method: 'OS process-tree RSS and cumulative CPU time; no debugger or automation flags',
  }),
);

for (const scenario of ['panel-and-overlay', 'overlay-only', 'tray-only'] as const) {
  const dataDirectory = await mkdtemp(join(tmpdir(), 'agent-guild-measure-'));
  const child = spawn(executable, process.env.AGENT_GUILD_EXECUTABLE ? [] : ['.'], {
    env: {
      ...process.env,
      AGENT_GUILD_SMOKE: '0',
      AGENT_GUILD_DATA_DIR: dataDirectory,
      AGENT_GUILD_MEASURE_SURFACE: scenario,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  let errors = '';
  let launchError: Error | undefined;
  child.stdout.on('data', (chunk) => {
    output += String(chunk);
  });
  child.stderr.on('data', (chunk) => {
    errors += String(chunk);
  });
  child.on('error', (error) => {
    launchError = error;
  });
  const closed = new Promise<void>((resolve) => child.once('close', () => resolve()));
  try {
    await delay(4000);
    if (launchError) throw launchError;
    if (child.exitCode !== null || !child.pid)
      throw new Error(`Application did not start: ${errors}`);
    const windows = output
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as { surface: string; visible: boolean });
    if (
      windows.length !== 2 ||
      windows.some(
        (window) =>
          window.visible !==
          (scenario === 'panel-and-overlay' ||
            (scenario === 'overlay-only' && window.surface === 'overlay')),
      )
    )
      throw new Error(`Unexpected benchmark window visibility: ${output}`);
    let previous = processTree(child.pid);
    let previousTime = performance.now();
    const samples = [];
    for (let sample = 0; sample < 10; sample++) {
      await delay(1000);
      const current = processTree(child.pid);
      const currentTime = performance.now();
      const elapsedSeconds = (currentTime - previousTime) / 1000;
      const cpuSeconds = current.reduce(
        (sum, process) =>
          sum +
          process.cpuSeconds -
          (previous.find((old) => old.pid === process.pid)?.cpuSeconds ?? 0),
        0,
      );
      if (current.length === 0) throw new Error(`Application exited during measurement: ${errors}`);
      samples.push({
        singleCoreCpuPercent: (cpuSeconds / elapsedSeconds) * 100,
        summedRssMiB: current.reduce((sum, process) => sum + process.rssKiB, 0) / 1024,
        processCount: current.length,
      });
      previous = current;
      previousTime = currentTime;
    }
    console.log(
      JSON.stringify({
        scenario,
        windows,
        samples,
        meanSingleCoreCpuPercent:
          samples.reduce((sum, sample) => sum + sample.singleCoreCpuPercent, 0) / samples.length,
        meanSummedRssMiB:
          samples.reduce((sum, sample) => sum + sample.summedRssMiB, 0) / samples.length,
      }),
    );
  } finally {
    if (child.exitCode === null && !launchError) child.kill('SIGTERM');
    await closed;
    await rm(dataDirectory, { recursive: true, force: true });
  }
}

// RSS sums include shared pages and omit GPU allocations/compression. These short fresh-launch
// samples are a local baseline, not a battery benchmark. Only disposable profiles are removed.
