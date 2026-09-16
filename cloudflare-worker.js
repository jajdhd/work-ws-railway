// Cloudflare Worker: reverse proxy in front of the Railway origin.
//
// Why: fronting through Cloudflare puts your traffic on Cloudflare's IP
// ranges and TLS fingerprint instead of connecting directly to the
// Railway subdomain, and gives WebSocket/xhttp upgrades a well-tested
// path to ride through.
//
// This file is transport-agnostic on purpose: it never looks at which
// Xray inbound (ws-in vs xhttp-in) a request is destined for. It just
// forwards method, headers, path and body as-is, and Xray/Caddy on the
// origin decide which inbound handles the request based on the path.
// So this file needs NO changes to support both WS and XHTTP side by
// side - adding a third transport later wouldn't require touching it
// either.
//
// Set ORIGIN_HOST below to your Railway domain before deploying.

const ORIGIN_HOST = "io.manob.ir";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.hostname = ORIGIN_HOST;
    url.protocol = "https:";

    const upgradeHeader = request.headers.get("Upgrade");

    // WebSocket upgrade (used by the ws-in inbound): proxy the raw
    // socket through to the origin.
    if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
      return fetch(url.toString(), request);
    }

    // Plain HTTP / xhttp (used by the xhttp-in inbound): forward method,
    // headers, and body as-is. XHTTP's "auto" mode alternates between
    // GET (download) and POST (upload) requests on the same path, and
    // this forwards both the same way, so no special-casing is needed.
    const originRequest = new Request(url.toString(), {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: "manual",
    });

    return fetch(originRequest);
  },
};
