/*
 * Wrapper around `cap sync`.
 *
 * CocoaPods refuses to run under a non-UTF-8 locale, and macOS hands npm
 * scripts a bare environment where LANG is often unset — so a plain
 * `cap sync` dies partway through the iOS step with an
 * Encoding::CompatibilityError. Setting it here keeps the documented
 * one-command workflow working without asking anyone to edit their shell
 * profile, and does it cross-platform (a bare `LANG=… cap sync` in the npm
 * script would break on Windows, where Android devs run this too).
 */

import { spawn } from "node:child_process";

const env = { ...process.env };
if (!env.LANG || !/utf-?8/i.test(env.LANG)) env.LANG = "en_US.UTF-8";
if (!env.LC_ALL || !/utf-?8/i.test(env.LC_ALL)) env.LC_ALL = "en_US.UTF-8";

const child = spawn("cap", ["sync", ...process.argv.slice(2)], {
  env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code) => process.exit(code ?? 1));
