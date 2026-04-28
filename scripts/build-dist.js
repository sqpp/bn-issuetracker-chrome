const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const distDir = path.join(root, "dist");

const requiredPaths = [
  "manifest.json",
  "background.js",
  "content-script.js",
  "index.html",
  "management.html",
  "management.js",
  "options.html",
  "options.js",
  "css",
  "assets",
];

function ensureExists(absPath, relPath) {
  if (!fs.existsSync(absPath)) {
    throw new Error(`Missing required path: ${relPath}`);
  }
}

function copyToDist(relPath) {
  const source = path.join(root, relPath);
  const target = path.join(distDir, relPath);
  ensureExists(source, relPath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.cpSync(source, target, { recursive: true });
}

function buildDist() {
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  for (const relPath of requiredPaths) {
    copyToDist(relPath);
  }

  console.log(`Dist prepared at: ${distDir}`);
}

buildDist();
