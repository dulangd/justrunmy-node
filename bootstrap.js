#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { spawn } = require('child_process');

const publicEndpoint = String(process.env.PUBLIC_ENDPOINT || '').trim().replace(/\/+$/, '');
const localHealth = `http://127.0.0.1:${process.env.PORT || 8080}/health`;
const runtimeFile = '/app/.runtime-index.js';

// The node reports facts only. Railway owns the final client-visible remark/prefix.
let source = fs.readFileSync('/app/index.js', 'utf8');
const oldNodeName = "function nodeName() {\n  return `${countryState.code || 'XX'}-${identity.nodeNameBase}`;\n}";
if (!source.includes(oldNodeName)) throw new Error('nodeName patch target not found');
source = source.replace(oldNodeName, "function nodeName() {\n  return identity.nodeNameBase;\n}");

// Pass verified country as telemetry to Railway; do not bake it into the node name.
const oldPublicProofTail = "      endpoint: baseUrl(publicEndpoint),\n      proof: registryProof\n    });";
const newPublicProofTail = "      endpoint: baseUrl(publicEndpoint),\n      proof: registryProof,\n      country: countryState.code,\n      country_verified: countryState.verified\n    });";
if (!source.includes(oldPublicProofTail)) throw new Error('public-proof payload patch target not found');
source = source.replace(oldPublicProofTail, newPublicProofTail);
fs.writeFileSync(runtimeFile, source);

// PUBLIC_ENDPOINT coordinates bootstrap only. index.js must learn the endpoint from
// a real public request that reaches this exact container.
try { fs.rmSync('/app/.state/public-endpoint.json', { force: true }); } catch {}
const childEnv = { ...process.env };
delete childEnv.PUBLIC_ENDPOINT;

const child = spawn(process.execPath, [runtimeFile], {
  stdio: 'inherit',
  env: childEnv
});

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function getJson(url, timeoutMs = 5000) {
  const r = await fetch(url, {
    cache: 'no-store',
    headers: { 'user-agent': 'justrunmy-bootstrap/1.3.0' },
    signal: AbortSignal.timeout(timeoutMs)
  });
  let body = null;
  try { body = await r.json(); } catch {}
  return { status: r.status, ok: r.ok, body };
}

async function waitForLocalGeo() {
  for (;;) {
    if (child.exitCode !== null) throw new Error(`node process exited with code ${child.exitCode}`);
    try {
      const r = await getJson(localHealth, 3000);
      if (r.ok && r.body?.ok === true && r.body?.geo?.verified === true) {
        console.log(`[bootstrap] local service ready; geo=${r.body.geo.country} ip=${r.body.geo.egress_ip || 'unknown'}`);
        return;
      }
    } catch {}
    await sleep(1000);
  }
}

async function waitForPublicRoute() {
  if (!publicEndpoint) {
    console.warn('[bootstrap] PUBLIC_ENDPOINT is not set; endpoint learning will wait for the first external request');
    return;
  }

  let attempt = 0;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`node process exited with code ${child.exitCode}`);
    attempt += 1;
    try {
      const url = `${publicEndpoint}/health?bootstrap=${Date.now()}`;
      const r = await getJson(url, 7000);
      if (
        r.ok &&
        r.body?.ok === true &&
        r.body?.provider === 'justrunmy' &&
        r.body?.node_id === 'justrunmy-01' &&
        r.body?.endpoint_ready === true
      ) {
        console.log(`[bootstrap] public route verified after ${attempt} attempt(s): ${publicEndpoint}`);
        return;
      }
      console.warn(`[bootstrap] public route not ready yet: HTTP ${r.status}; retrying`);
    } catch (e) {
      console.warn(`[bootstrap] public route check failed: ${e.message}; retrying`);
    }
    await sleep(Math.min(5000 + attempt * 1000, 15000));
  }
}

(async () => {
  try {
    await waitForLocalGeo();
    await waitForPublicRoute();
  } catch (e) {
    console.error('[bootstrap] readiness coordinator stopped:', e.message);
  }
})();

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    if (!child.killed) child.kill(sig);
  });
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
