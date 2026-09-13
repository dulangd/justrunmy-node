'use strict';

function replaceOnce(source, label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`runtime patch target not found: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`runtime patch target duplicated: ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function patchRuntime(input) {
  let source = String(input);

  const oldNodeName = "function nodeName() {\n  return `${countryState.code || 'XX'}-${identity.nodeNameBase}`;\n}";
  source = replaceOnce(source, 'node-name-owner', oldNodeName, "function nodeName() {\n  return identity.nodeNameBase;\n}");

  source = replaceOnce(
    source,
    'public-proof-country-telemetry',
    "      endpoint: baseUrl(publicEndpoint),\n      proof: registryProof\n    });",
    "      endpoint: baseUrl(publicEndpoint),\n      proof: registryProof,\n      country: countryState.code,\n      country_verified: countryState.verified\n    });"
  );

  source = replaceOnce(
    source,
    'registration-promise-state',
    "let registerTimer = null;\nlet registered = false;",
    "let registerTimer = null;\nlet registerPromise = null;\nlet registered = false;"
  );

  source = replaceOnce(
    source,
    'registration-wrapper',
    "async function registerNode() {\n  if (!publicEndpoint?.host) return false;",
    "async function registerNode() {\n  if (registerPromise) return registerPromise;\n  registerPromise = registerNodeOnce().finally(() => { registerPromise = null; });\n  return registerPromise;\n}\n\nasync function registerNodeOnce() {\n  if (!publicEndpoint?.host) return false;"
  );

  source = source.replace("    console.log(`[registry] bearer register attempt node_id=${identity.nodeId} name=${nodeName()} url=${REGISTRY_URL}`);\n", '');
  source = source.replace("    console.log(`[registry] public-proof register attempt node_id=${identity.nodeId} name=${nodeName()} url=${REGISTRY_URL}`);\n", '');

  source = replaceOnce(
    source,
    'registry-success-log',
    "  registryLastSuccessAt = new Date().toISOString();\n  console.log(`[registry] registered node_id=${identity.nodeId} name=${nodeName()} mode=${REGISTRY_TOKEN ? 'bearer-token' : 'public-proof'}`);",
    "  const firstRegistrySuccess = !registryLastSuccessAt;\n  registryLastSuccessAt = new Date().toISOString();\n  if (firstRegistrySuccess) console.log(`[registry] connected node_id=${identity.nodeId} name=${nodeName()} mode=${REGISTRY_TOKEN ? 'bearer-token' : 'public-proof'}`);"
  );

  if (!source.includes('let registerPromise = null;') || !source.includes('async function registerNodeOnce()')) {
    throw new Error('public-proof anti-spam patch validation failed');
  }
  if (source.includes('[registry] public-proof register attempt') || source.includes('[registry] bearer register attempt')) {
    throw new Error('repeat registry attempt logging still present');
  }

  return source;
}

module.exports = { patchRuntime };
