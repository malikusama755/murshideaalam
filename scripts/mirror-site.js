const fs = require("fs");
const path = require("path");
const { Readable } = require("stream");
const { pipeline } = require("stream/promises");

const ORIGIN = "http://www.pirghulamhabib.com";
const OUT = path.join(__dirname, "..", "public", "archive");
const SMALL_CONCURRENCY = 6;
const LARGE_CONCURRENCY = 8;

const htmlQueue = [`${ORIGIN}/`];
const assetQueue = [];
const seen = new Set();
const failed = [];
let activeSmall = 0;
let activeLarge = 0;

function shouldSkip(url) {
  return (
    url.includes("_vti_bin") ||
    url.includes("_vti_cnf") ||
    url.includes("fpcount.exe") ||
    url.startsWith("mailto:") ||
    url.startsWith("javascript:") ||
    url.startsWith("data:")
  );
}

function isLarge(urlString) {
  return /\.(mp3|wma|wav|wmv|avi|mp4|mov|pdf|zip)$/i.test(new URL(urlString).pathname);
}

function isHtml(urlString) {
  const pathname = new URL(urlString).pathname;
  return pathname.endsWith("/") || /\.html?$/i.test(pathname);
}

function toAbsolute(raw, base) {
  if (!raw) return null;
  const cleaned = raw.trim().replace(/\\/g, "/");
  if (!cleaned || cleaned.startsWith("#") || shouldSkip(cleaned)) return null;
  try {
    const url = new URL(cleaned, base);
    if (url.hostname !== "www.pirghulamhabib.com" && url.hostname !== "pirghulamhabib.com") {
      return null;
    }
    url.hash = "";
    url.protocol = "http:";
    url.hostname = "www.pirghulamhabib.com";
    return url.toString();
  } catch {
    return null;
  }
}

function localPath(urlString) {
  const url = new URL(urlString);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.endsWith("/")) pathname += "index.htm";
  const safe = pathname
    .replace(/^\/+/, "")
    .split("/")
    .map((part) => part.replace(/[<>:"|?*]/g, "_"));
  return path.join(OUT, ...safe);
}

function extractLinks(html, base) {
  const links = new Set();
  const attr = /(?:href|src|background|lowsrc|file-href)\s*=\s*(?:"([^"]+)"|'([^']+)')/gi;
  let match;
  while ((match = attr.exec(html))) {
    const absolute = toAbsolute(match[1] || match[2] || match[3], base);
    if (absolute) links.add(absolute);
  }
  return [...links];
}

function enqueue(url) {
  if (!url || seen.has(url) || shouldSkip(url)) return;
  seen.add(url);
  if (isLarge(url)) assetQueue.push(url);
  else htmlQueue.push(url);
}

function rememberLinks(html, base) {
  for (const link of extractLinks(html, base)) enqueue(link);
}

async function download(urlString) {
  const dest = localPath(urlString);
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    if (isHtml(urlString) || /\.(css|js)$/i.test(dest)) {
      rememberLinks(fs.readFileSync(dest, "latin1"), urlString);
    }
    console.log(`SKIP ${urlString}`);
    return;
  }

  const partial = `${dest}.part`;
  try {
    const response = await fetch(urlString, {
      redirect: "follow",
      headers: { "User-Agent": "murshideaalam-site-mirror/1.0" },
    });
    if (!response.ok || !response.body) {
      failed.push({ url: urlString, status: response.status });
      console.log(`FAIL ${response.status} ${urlString}`);
      return;
    }

    if (isHtml(urlString) || /\.(css|js|svg)$/i.test(new URL(urlString).pathname)) {
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(dest, buffer);
      console.log(`OK ${buffer.length} ${urlString}`);
      rememberLinks(buffer.toString("latin1"), urlString);
      return;
    }

    await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(partial));
    const size = fs.statSync(partial).size;
    fs.renameSync(partial, dest);
    console.log(`OK ${size} ${urlString}`);
  } catch (error) {
    fs.rmSync(partial, { force: true });
    failed.push({ url: urlString, error: error.message });
    console.log(`FAIL ${urlString} ${error.message}`);
  }
}

async function run() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("PHASE pages");

  while (htmlQueue.length > 0 || activeSmall > 0) {
    while (activeSmall < SMALL_CONCURRENCY && htmlQueue.length > 0) {
      const next = htmlQueue.shift();
      activeSmall += 1;
      download(next).finally(() => {
        activeSmall -= 1;
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  console.log(`PHASE media queued=${assetQueue.length}`);
  while (assetQueue.length > 0 || activeLarge > 0) {
    while (activeLarge < LARGE_CONCURRENCY && assetQueue.length > 0) {
      const next = assetQueue.shift();
      activeLarge += 1;
      download(next).finally(() => {
        activeLarge -= 1;
      });
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  const retry = failed.splice(0, failed.length);
  for (const item of retry) {
    seen.delete(item.url);
    console.log(`RETRY ${item.url}`);
    await download(item.url);
  }

  fs.writeFileSync(path.join(OUT, "_manifest.json"), JSON.stringify({ failed, seen: [...seen] }, null, 2));
  console.log(`DONE failed=${failed.length} seen=${seen.size}`);
}

run();
