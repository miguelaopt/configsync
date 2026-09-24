import { SITE, applyMessage, gameView, importMessage, parseResult } from "./view.js";

const { Command } = window.__TAURI__.shell;
const { openUrl } = window.__TAURI__.opener;
const SIDECAR = "binaries/csync";
const app = document.getElementById("app");

const NOT_STARTED = (e) =>
  `ConfigSync could not start its companion (${e}). Reinstall the app, or use csync from a terminal.`;

/** Runs `csync <args> --json`. Never throws: every failure comes back as { ok: false, error }. */
async function csync(args) {
  try {
    return parseResult(await Command.sidecar(SIDECAR, [...args, "--json"]).execute());
  } catch (e) {
    return { ok: false, error: NOT_STARTED(e) };
  }
}

/** `csync login` with the token on stdin — never an argument, which other processes can read. */
async function login(token) {
  const cmd = Command.sidecar(SIDECAR, ["login", SITE, "--json"]);
  let stdout = "";
  cmd.stdout.on("data", (line) => (stdout += `${line}\n`));
  const closed = new Promise((resolve) => {
    cmd.on("close", ({ code }) => resolve(parseResult({ code, stdout })));
    cmd.on("error", (e) => resolve({ ok: false, error: NOT_STARTED(e) }));
  });
  try {
    const child = await cmd.spawn();
    await child.write(`${token}\n`);
  } catch (e) {
    return { ok: false, error: NOT_STARTED(e) };
  }
  return closed;
}

/** Tiny DOM builder. Text goes through textContent, never innerHTML: names are user data. */
function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  for (const c of children) if (c != null) node.append(c);
  return node;
}

function show(...nodes) {
  app.replaceChildren(...nodes);
}

async function refresh() {
  show(el("p", { className: "muted", textContent: "Loading…" }));
  const r = await csync(["status"]);
  if (!r.ok) return showError(r.error);
  if (!r.data.loggedIn) return showConnect();
  showGames(r.data);
}

function showError(message) {
  show(
    el(
      "section",
      { className: "panel stack" },
      el("p", { className: "result bad", textContent: message }),
      el("div", {}, el("button", { textContent: "Retry", onclick: refresh })),
    ),
  );
}

function showConnect(error = "") {
  const token = el("input", {
    type: "password",
    placeholder: "Paste your companion token",
    autocomplete: "off",
  });
  const connect = el("button", { className: "primary", textContent: "Connect" });
  const message = el("p", { className: "result bad", textContent: error });
  const form = el(
    "form",
    { className: "panel stack" },
    el("h1", { textContent: "Connect this PC" }),
    el("p", {
      className: "muted",
      textContent: "Create a token in ConfigSync under Settings → Companion, then paste it here.",
    }),
    el(
      "div",
      {},
      el("button", {
        type: "button",
        textContent: "Open ConfigSync",
        onclick: () => openUrl(`${SITE}/settings#companion`),
      }),
    ),
    token,
    el("div", {}, connect),
    message,
  );
  form.onsubmit = async (e) => {
    e.preventDefault();
    const value = token.value.trim();
    if (!value) return;
    connect.disabled = true;
    message.textContent = "";
    const r = await login(value);
    token.value = "";
    if (!r.ok) {
      connect.disabled = false;
      message.textContent = r.error;
      return;
    }
    refresh();
  };
  show(form);
  token.focus();
}

function showGames(s) {
  const header = el(
    "header",
    { className: "panel" },
    el(
      "div",
      {},
      el("h1", { textContent: s.device }),
      el("span", { className: "muted", textContent: s.user.email }),
    ),
    el("span", { className: `pill ${s.plan}`, textContent: s.plan === "pro" ? "Pro ●" : "Free" }),
  );
  const rows = s.games.map((g) => gameRow(s, gameView(g)));
  show(
    header,
    ...(rows.length
      ? rows
      : [el("p", { className: "panel muted", textContent: "No games in the catalog yet." })]),
  );
}

function gameRow(s, v) {
  const result = el("p", { className: "result", role: "status" });
  const buttons = [];
  /** Runs one action on this row; every button on the row waits, the result lands on the row. */
  const act = (args, message, after) => async () => {
    buttons.forEach((b) => (b.disabled = true));
    result.className = "result muted";
    result.textContent = "Working…";
    const r = await csync(args);
    buttons.forEach((b) => (b.disabled = false));
    result.className = `result ${r.ok ? "ok" : "bad"}`;
    result.textContent = r.ok ? message(r.data) : r.error;
    if (r.ok) after?.(r.data);
  };
  if (v.canApply) {
    const target = s.games.find((g) => g.id === v.id).target;
    buttons.push(
      el("button", {
        className: "primary",
        textContent: "Apply",
        onclick: act(["apply", v.id, target.presetSlug], applyMessage, () =>
          setTimeout(refresh, 1500),
        ),
      }),
    );
  }
  if (v.canImport)
    buttons.push(
      el("button", {
        textContent: "Import",
        title: "Save what the game has on this PC as a new preset",
        onclick: act(["import", v.id], importMessage, (d) => openUrl(`${s.url}${d.url}`)),
      }),
    );
  return el(
    "section",
    { className: `panel game${v.dim ? " dim" : ""}` },
    el(
      "div",
      { className: "row" },
      el("strong", { textContent: v.name }),
      el("span", { className: "muted", textContent: v.files }),
    ),
    el(
      "div",
      { className: "row" },
      el("span", { textContent: v.preset }),
      el("div", { className: "actions" }, ...buttons),
    ),
    v.applied ? el("span", { className: "muted", textContent: v.applied }) : null,
    result,
  );
}

refresh();
