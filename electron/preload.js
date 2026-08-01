const { contextBridge } = require("electron");

/*
 * The page is our own Next app, but it's still loaded over HTTP and can render
 * user-supplied content, so it gets no Node access — just a flag it can read
 * to tell it's running in the desktop shell (see lib/runtime.ts).
 */
contextBridge.exposeInMainWorld("lonelygirl", {
  desktop: true,
  platform: process.platform,
  version: process.env.npm_package_version ?? "",
});
