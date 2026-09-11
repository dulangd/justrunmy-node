# justrunmy-node

Dedicated JustRunMy.App container for a private VLESS-over-WebSocket endpoint.

## What it does

- Listens on `0.0.0.0:${PORT}` (`8080` by default).
- Serves a neutral landing page at `/` and JSON health status at `/health`.
- Provides authenticated VLESS over WebSocket (TCP only).
- Learns the public JustRunMy.App HTTPS endpoint automatically from the first public request.
- Prints a final `vless://` URL plus plain/base64 single-node subscriptions to app logs.
- Verifies the server egress country with Cloudflare + ipinfo and prefixes the client remark with the verified country code.
- Registers/refreshes itself in the existing Railway subscription registry.

## JustRunMy.App deployment

1. Create an application with **Advanced -> Git Push**.
2. Keep resources at the free baseline: **0.15 vCPU / 0.25 GB RAM / 0.3 GB disk**.
3. Clone this repository locally if needed:

```bash
git clone https://github.com/dulangd/justrunmy-node.git
cd justrunmy-node
```

4. Run the exact Git Push command supplied by JustRunMy.App. Do not publish that URL because it contains deployment credentials.
5. Map container port **8080** to an **HTTPS** public endpoint.
6. Open the generated public URL once, preferably `/health`. This teaches the app its public hostname and triggers Railway registration.
7. Check logs for:

```text
[geo] verified egress country=..
[endpoint] learned https://...
[client] VLESS URL: vless://...
[registry] registered ...
```

## Optional environment variables

The app works without extra variables for the first test. To keep credentials stable across full image redeploys, set these in the JustRunMy.App panel later:

- `UUID` - VLESS UUID (v4 format)
- `WS_PATH` - WebSocket path, e.g. `/ws-random-string`
- `SUB_TOKEN` - protects `/sub`, `/sub64` and `/node`
- `REGISTRY_PROOF` - random string of at least 32 characters
- `NODE_ID` - defaults to `justrunmy-01`
- `NODE_NAME` - defaults to `JustRunMy-01`; the verified country prefix is added automatically
- `PUBLIC_ENDPOINT` - optional manual override, normally unnecessary
- `REGISTRY_URL` - defaults to the existing Railway registry URL
- `REGISTRY_TOKEN` - optional bearer mode; without it the existing public-proof registration flow is used
- `HEARTBEAT_MS` - defaults to 600000 (10 minutes)

Do not commit UUIDs, tokens, registry proofs, or JustRunMy.App Git Push credentials to this repository.

## Client outputs

After the public endpoint is learned, logs provide:

- final `vless://` URL for v2rayN/Shadowrocket
- `/<SUB_TOKEN>/sub` plain single-node subscription
- `/<SUB_TOKEN>/sub64` base64 single-node subscription
- `/<SUB_TOKEN>/node` JSON node information

The current transport supports VLESS TCP over WebSocket. UDP is not implemented.
