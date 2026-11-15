// Suíte de testes para o `onp-spec verify` (testCommand do onpspec.config.json).
//
// O verify de cada feature roda a suíte inteira. Na bateria são 4 features seguidas sobre
// o MESMO código, então este script guarda o relatório com uma impressão digital do código
// (commit + mudanças não commitadas + arquivos novos) e, se nada mudou, devolve o mesmo
// relatório sem rodar de novo. Qualquer mudança fora de .spec/ invalida e roda tudo.
// ONP_FRESH=1 força rodar.
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const REPORT = '.spec/verification/vitest-report.json';
const STAMP = '.spec/verification/vitest-report.stamp.json';
// .spec/ fica de fora: o próprio verify grava as provas lá, e os testes não leem nada dali.
const OUTSIDE_SPEC = ['--', '.', ':(exclude).spec'];

const git = (...args) => execFileSync('git', args, { maxBuffer: 1 << 30 });

function fingerprint() {
  const hash = createHash('sha256');
  hash.update(git('rev-parse', 'HEAD'));
  hash.update(git('diff', 'HEAD', '--binary', ...OUTSIDE_SPEC));
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z', ...OUTSIDE_SPEC)
    .toString()
    .split('\0')
    .filter(Boolean)
    .sort();
  for (const file of untracked) {
    hash.update(`\0${file}\0`);
    hash.update(readFileSync(file));
  }
  return hash.digest('hex');
}

function previousRun() {
  if (!existsSync(REPORT) || !existsSync(STAMP)) return null;
  try {
    return JSON.parse(readFileSync(STAMP, 'utf8'));
  } catch {
    return null;
  }
}

const current = fingerprint();
const previous = previousRun();

if (process.env.ONP_FRESH !== '1' && previous?.fingerprint === current) {
  console.log(`spec-tests: código igual ao da rodada de ${previous.at}; relatório reaproveitado (exit ${previous.exitCode}).`);
  process.exit(previous.exitCode);
}

rmSync(REPORT, { force: true });
rmSync(STAMP, { force: true });
const run = spawnSync(
  'pnpm',
  ['vitest', 'run', '--reporter=default', '--reporter=json', `--outputFile.json=${REPORT}`],
  { stdio: 'inherit', shell: true },
);
const exitCode = run.status ?? 1;
// Só carimba se o código não mudou durante a rodada (ex.: alguém editou um arquivo no meio).
if (existsSync(REPORT) && fingerprint() === current) {
  writeFileSync(STAMP, `${JSON.stringify({ fingerprint: current, exitCode, at: new Date().toISOString() }, null, 2)}\n`);
}
process.exit(exitCode);
