'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { patchRuntime } = require('./runtime-patch');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const raw = fs.readFileSync(path.join(__dirname, 'index.js'), 'utf8');
const out = patchRuntime(raw);

assert(out.includes('let registerPromise = null;'), 'registerPromise missing');
assert(out.includes('if (registerPromise) return registerPromise;'), 'concurrent registration coalescing missing');
assert(out.includes('async function registerNodeOnce()'), 'registerNodeOnce missing');
assert(!out.includes('[registry] public-proof register attempt'), 'public-proof attempt log still present');
assert(!out.includes('[registry] bearer register attempt'), 'bearer attempt log still present');
assert(out.includes('if (firstRegistrySuccess) console.log(`[registry] connected'), 'first-success-only log missing');
assert(out.includes('country: countryState.code'), 'country telemetry missing');
assert(out.includes('country_verified: countryState.verified'), 'country verification telemetry missing');
assert(out.includes('if (!REGISTRY_TOKEN) {\n    try { await registerNode(); }'), 'public-proof 10-minute refresh semantics changed');
assert(out.includes('function nodeName() {\n  return identity.nodeNameBase;\n}'), 'Railway-owned remark naming changed');

const tmp = path.join(os.tmpdir(), `justrunmy-runtime-${process.pid}.js`);
fs.writeFileSync(tmp, out);
const check = spawnSync(process.execPath, ['--check', tmp], { encoding: 'utf8' });
try { fs.unlinkSync(tmp); } catch {}
assert(check.status === 0, `generated runtime syntax failed: ${check.stderr || check.stdout}`);

console.log('PASS JustRunMy public-proof anti-spam runtime patch');
