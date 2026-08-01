/** @type {import('next').NextConfig} */
const nextConfig = {
  // The desktop build ships its own copy of the Next server inside Electron,
  // so the app runs without a deployment. "standalone" is what traces the
  // server and its dependencies into .next/standalone for us to bundle.
  output: "standalone",
};

export default nextConfig;
