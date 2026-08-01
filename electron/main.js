/*
 * Desktop shell.
 *
 * LonelyGirl is server-rendered end to end — every page is an async server
 * component reading Supabase auth cookies, plus middleware and a server
 * action — so there is no static bundle to drop into a window. Instead the
 * packaged app carries its own copy of the Next server (`output: "standalone"`)
 * and this process boots it on loopback before pointing a window at it. The
 * result needs no deployment: double-click and it runs.
 */

const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const net = require("node:net");
const http = require("node:http");
const { fork } = require("node:child_process");

const isDev = !app.isPackaged;

/*
 * Fixed, not ephemeral. The Google sign-in redirect lands on
 * http://localhost:<port>/auth/callback, and Supabase only honours redirect
 * URLs that are on its allowlist — a random port each launch would mean a URL
 * that can never be allowlisted. See README for the one entry to add.
 */
const DESKTOP_PORT = 43110;

/*
 * `npm run desktop` starts next dev on this port and points the window at it.
 * Deliberately not 3000: if that's already taken Next quietly moves to 3001
 * and the window would sit waiting on a port nothing is serving. Override with
 * LONELYGIRL_DEV_URL to attach the window to a dev server you started yourself.
 */
const DEV_SERVER_URL = process.env.LONELYGIRL_DEV_URL ?? "http://localhost:43111";

let mainWindow = null;
let serverProcess = null;
let serverUrl = DEV_SERVER_URL;
let isQuitting = false;

/*
 * Google returns "disallowed_useragent" for anything it recognises as an
 * embedded browser, and Electron advertises itself in the UA by default.
 * Dropping the Electron and app-name tokens leaves an ordinary Chrome string,
 * which is what this window actually is.
 */
function useChromeUserAgent() {
  app.userAgentFallback = app.userAgentFallback
    .replace(/\sElectron\/\S+/, "")
    .replace(new RegExp(`\\s${app.getName()}\\/\\S+`, "i"), "");
}

function isFree(port) {
  return new Promise((resolve) => {
    const probe = net
      .createServer()
      .once("error", () => resolve(false))
      .once("listening", () => probe.close(() => resolve(true)))
      .listen(port, "127.0.0.1");
  });
}

async function choosePort() {
  if (await isFree(DESKTOP_PORT)) return DESKTOP_PORT;
  // Something else already has it. Step to the next free port so the app still
  // opens — email/password sign-in is unaffected, only the Google redirect is,
  // since the allowlisted URL names the preferred port.
  for (let port = DESKTOP_PORT + 1; port <= DESKTOP_PORT + 20; port += 1) {
    if (await isFree(port)) {
      console.warn(
        `[lonelygirl] port ${DESKTOP_PORT} is in use — serving on ${port} instead. ` +
          `Google sign-in needs ${DESKTOP_PORT}; email sign-in still works.`
      );
      return port;
    }
  }
  throw new Error(`No free port in ${DESKTOP_PORT}–${DESKTOP_PORT + 20}.`);
}

function waitForServer(url, timeoutMs = 30000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (Date.now() > deadline) reject(new Error(`Timed out waiting for ${url}`));
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

/*
 * Runs the traced Next server from resources/server. `fork` with
 * ELECTRON_RUN_AS_NODE reuses Electron's own Node binary, so the packaged app
 * has no dependency on whatever Node the user does or doesn't have installed.
 */
async function startServer() {
  const serverDir = path.join(process.resourcesPath, "server");
  const entry = path.join(serverDir, "server.js");

  if (!fs.existsSync(entry)) {
    throw new Error(
      `Bundled server missing at ${entry}. Run "npm run desktop:build" rather than packaging by hand.`
    );
  }

  const port = await choosePort();

  serverProcess = fork(entry, [], {
    cwd: serverDir,
    execPath: process.execPath,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: ["ignore", "inherit", "inherit", "ipc"],
  });

  serverProcess.on("exit", (code) => {
    serverProcess = null;
    // A server that dies takes the app with it — a blank window would be
    // worse than a clean quit.
    if (code !== 0 && !isQuitting) app.quit();
  });

  serverUrl = `http://localhost:${port}`;
  await waitForServer(serverUrl);
  return serverUrl;
}

function shouldOpenExternally(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  const host = url.hostname;
  // Our own server.
  if (host === "localhost" || host === "127.0.0.1") return false;
  // The Google → Supabase → back-to-us sign-in chain has to stay in-window,
  // otherwise the session cookie is set in the user's browser, not here.
  if (/(^|\.)google\.com$/.test(host)) return false;
  if (/(^|\.)gstatic\.com$/.test(host)) return false;
  if (/(^|\.)supabase\.co$/.test(host)) return false;

  // Everything else — Shopify checkout, Apple Music links, anything a user
  // pastes into a chat room — belongs in a real browser.
  return true;
}

function createWindow(startUrl) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 560,
    backgroundColor: "#1e1e23",
    // Keeps the traffic lights over the app's own chrome on macOS, which
    // suits a full-bleed page like the TV pile.
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Held back until the first paint so the window doesn't flash empty grey.
  // The timer is the safety net: if ready-to-show never fires — a failed load,
  // a renderer crash — an invisible window is indistinguishable from an app
  // that didn't launch, so show it anyway and let the page report the error.
  const reveal = () => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
      mainWindow.focus();
    }
  };
  mainWindow.once("ready-to-show", reveal);
  setTimeout(reveal, 8000);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (shouldOpenExternally(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (shouldOpenExternally(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.loadURL(startUrl);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      ...(isMac ? [{ role: "appMenu" }] : []),
      { role: "editMenu" },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      },
      { role: "windowMenu" },
    ])
  );
}

// A second launch should focus the window we already have, not boot a second
// copy of the server on the same port.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  useChromeUserAgent();

  app.whenReady().then(async () => {
    buildMenu();

    try {
      if (isDev) await waitForServer(DEV_SERVER_URL);
      else await startServer();
      createWindow(serverUrl);
    } catch (error) {
      console.error("[lonelygirl] could not start:", error);
      app.quit();
      return;
    }

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(serverUrl);
    });
  });

  app.on("before-quit", () => {
    isQuitting = true;
    serverProcess?.kill();
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
