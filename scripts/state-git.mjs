import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, writeFile, copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const branch = 'monitor-data';
const reference = `refs/remotes/origin/${branch}`;
const worktree = resolve(root, '.monitor-state');
const git = (args, cwd = root) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

if (process.argv[2] === 'restore') {
  const result = spawnSync('git', ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`], { cwd: root, encoding: 'utf8' });
  if (result.status === 2) { console.log('First run: no saved monitoring state.'); process.exit(0); }
  if (result.status !== 0) throw new Error('Cannot read monitoring branch; refusing to discard history.');
  git(['fetch', '--depth=1', 'origin', `refs/heads/${branch}:${reference}`]);
  const snapshot = git(['show', `${reference}:data/snapshot.json`]);
  JSON.parse(snapshot);
  await mkdir(resolve(root, 'data'), { recursive: true });
  await writeFile(resolve(root, 'data/snapshot.json'), snapshot + '\n');
  console.log('Restored previous monitoring snapshot.');
} else if (process.argv[2] === 'save') {
  const exists = spawnSync('git', ['show-ref', '--verify', '--quiet', reference], { cwd: root }).status === 0;
  git(['worktree', 'add', '--detach', worktree, exists ? reference : 'HEAD']);
  try {
    if (!exists) { git(['checkout', '--orphan', branch], worktree); git(['rm', '-rf', '.'], worktree); }
    await mkdir(resolve(worktree, 'data'), { recursive: true });
    await copyFile(resolve(root, 'data/snapshot.json'), resolve(worktree, 'data/snapshot.json'));
    git(['add', 'data/snapshot.json'], worktree);
    git(['-c', 'user.name=github-actions[bot]', '-c', 'user.email=41898282+github-actions[bot]@users.noreply.github.com', 'commit', '-m', 'Update PAID monitoring snapshot'], worktree);
    git(['push', 'origin', `HEAD:refs/heads/${branch}`], worktree);
  } finally { git(['worktree', 'remove', '--force', worktree]); }
  console.log('Saved monitoring state without changing the source branch.');
} else throw new Error('Usage: node scripts/state-git.mjs restore|save');
