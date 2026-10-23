#!/usr/bin/env node
// CI guard (Phase 10): `main` is production and online payment is not released, so FEATURE_PAYMENTS must default to
// OFF in every place a default lives. Payment work continues on `feature/payments`; it may merge to main only while
// this script passes. Run: `npm run check:flags` (also a step in .github/workflows/ci.yml).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);
const read = (path) => readFileSync(resolve(root, path), 'utf8');
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};

// 1. The API schema: FEATURE_PAYMENTS is a plain boolFlag (unset → false); FEATURE_POS defaults on.
const envTs = read('apps/api/src/config/env.ts');
check(/^\s*FEATURE_PAYMENTS: boolFlag,\s*$/m.test(envTs), 'apps/api/src/config/env.ts: FEATURE_PAYMENTS must be `boolFlag` (unset → false)');
check(/^\s*FEATURE_POS: boolFlagDefaultOn,\s*$/m.test(envTs), 'apps/api/src/config/env.ts: FEATURE_POS must be `boolFlagDefaultOn`');

// 2. The shared defaults the front-ends fall back to before /api/config answers.
const featuresTs = read('packages/shared/src/features.ts');
check(/DEFAULT_FEATURE_FLAGS: FeatureFlags = \{ payments: false, pos: true \}/.test(featuresTs), 'packages/shared/src/features.ts: DEFAULT_FEATURE_FLAGS must be { payments: false, pos: true }');

// 3. The production env template and the compose default.
const envExample = read('deploy/.env.prod.example');
check(/^FEATURE_PAYMENTS=false\s*$/m.test(envExample), 'deploy/.env.prod.example: FEATURE_PAYMENTS=false');
check(/^FEATURE_POS=true\s*$/m.test(envExample), 'deploy/.env.prod.example: FEATURE_POS=true');
const compose = read('deploy/docker-compose.yml');
check(/FEATURE_PAYMENTS: \$\{FEATURE_PAYMENTS:-false\}/.test(compose), 'deploy/docker-compose.yml: FEATURE_PAYMENTS must default to false');

// 4. The marketing site build (Caddy image) and the Deploy workflow.
const dockerfile = read('deploy/Dockerfile.caddy');
check(/^ARG FEATURE_PAYMENTS=false\s*$/m.test(dockerfile), 'deploy/Dockerfile.caddy: ARG FEATURE_PAYMENTS=false');
const deployYml = read('.github/workflows/deploy.yml');
check(/FEATURE_PAYMENTS=\$\{\{ vars\.FEATURE_PAYMENTS \|\| 'false' \}\}/.test(deployYml), ".github/workflows/deploy.yml: FEATURE_PAYMENTS build arg must default to 'false'");

if (failures.length > 0) {
  console.error('Feature flag defaults are wrong for main (online payment must stay off by default):');
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log('check-feature-defaults: FEATURE_PAYMENTS defaults to false everywhere, FEATURE_POS to true');
