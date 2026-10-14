const fs = require("fs");
const path = require("path");

function walk(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.html?$/i.test(entry.name)) acc.push(full);
  }
  return acc;
}

const links = new Set();
const re = /(?:href|src|background)\s*=\s*["']([^"']+)["']/gi;
for (const file of walk("mirror")) {
  const html = fs.readFileSync(file, "latin1");
  let match;
  while ((match = re.exec(html))) links.add(match[1]);
}

const groups = { mp3: [], img: [], vid: [], htm: [], other: [] };
for (const link of links) {
  const clean = link.split("?")[0].toLowerCase();
  if (/\.(mp3|wma|wav)$/.test(clean)) groups.mp3.push(link);
  else if (/\.(jpg|jpeg|gif|png|bmp)$/.test(clean)) groups.img.push(link);
  else if (/\.(wmv|mp4|avi|mov|rm)$/.test(clean)) groups.vid.push(link);
  else if (/\.html?$/.test(clean)) groups.htm.push(link);
  else if (!/^https?:/i.test(link) && !link.startsWith("mailto") && !link.startsWith("#") && !link.includes("fpcount")) {
    groups.other.push(link);
  }
}

console.log("mp3", groups.mp3.length);
console.log(groups.mp3.sort().join("\n"));
console.log("---VID---");
console.log(groups.vid.join("\n"));
console.log("---HTM---");
console.log(groups.htm.sort().join("\n"));
console.log("---OTHER---");
console.log(groups.other.sort().join("\n"));
console.log("---IMG count", groups.img.length);
