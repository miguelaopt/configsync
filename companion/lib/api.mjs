/** Tiny client for /api/companion/*. Throws Error(message) with the server's text on non-2xx. */
export function api({ url, token }) {
  const base = url.replace(/\/$/, "");
  async function call(method, path, body) {
    const res = await fetch(`${base}/api/companion${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
    if (!res.ok) throw new Error(json?.error ?? `${res.status} ${res.statusText}`);
    return json;
  }
  return {
    get: (p) => call("GET", p),
    put: (p, b) => call("PUT", p, b),
    post: (p, b) => call("POST", p, b),
  };
}
