import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

test('monitor-data round trip preserves source branch and snapshot history without network', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'paid-git-state-'));
  const root = join(dir, 'source'), remote = join(dir, 'remote.git');
  const run = (cmd, args, cwd = root) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  try {
    await mkdir(root); run('git', ['init', '--bare', remote], dir); run('git', ['init', '-b', 'main']);
    run('git', ['config', 'user.name', 'Test']); run('git', ['config', 'user.email', 'test@example.com']);
    await mkdir(join(root, 'scripts'));
    await copyFile(new URL('../scripts/state-git.mjs', import.meta.url), join(root, 'scripts/state-git.mjs'));
    await writeFile(join(root, '.gitignore'), 'data/snapshot.json\n.monitor-state/\n');
    await writeFile(join(root, 'README.md'), 'Source stays intact');
    run('git', ['add', '.']); run('git', ['commit', '-m', 'initial']); run('git', ['remote', 'add', 'origin', remote]);
    run('git', ['push', '-u', 'origin', 'main']); const head = run('git', ['rev-parse', 'HEAD']);
    run(process.execPath, ['scripts/state-git.mjs', 'restore']);
    await mkdir(join(root, 'data')); await writeFile(join(root, 'data/snapshot.json'), JSON.stringify({ history: [1] }));
    run(process.execPath, ['scripts/state-git.mjs', 'save']);
    await rm(join(root, 'data/snapshot.json')); run(process.execPath, ['scripts/state-git.mjs', 'restore']);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'data/snapshot.json'), 'utf8')), { history: [1] });
    await writeFile(join(root, 'data/snapshot.json'), JSON.stringify({ history: [1, 2] }));
    run(process.execPath, ['scripts/state-git.mjs', 'save']);
    run(process.execPath, ['scripts/state-git.mjs', 'restore']);
    assert.deepEqual(JSON.parse(await readFile(join(root, 'data/snapshot.json'), 'utf8')), { history: [1, 2] });
    assert.equal(run('git', ['rev-parse', 'HEAD']), head);
    assert.equal(run('git', ['branch', '--show-current']), 'main');
    assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'Source stays intact');
    assert.equal(run('git', ['status', '--porcelain']), '');
  } finally { await rm(dir, { recursive: true, force: true }); }
});
