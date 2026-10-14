const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const ARCHIVE = path.join(__dirname, "..", "public", "archive");
const OUT_PAGES = path.join(__dirname, "..", "src", "content", "pages.json");
const OUT_REDIRECTS = path.join(__dirname, "..", "legacy-redirects.json");

const NAV = [
  ["index.htm", "/", "Home"],
  ["about_hazrat.htm", "/about", "About Murshid-e-Alam"],
  ["about_tariqat.htm", "/tariqat", "About Tariqat"],
  ["bayaans_page.htm", "/bayaans", "His Bayaans"],
  ["bayaan_extracts.htm", "/extracts", "Bayaan Extracts"],
  ["bayaan_download.htm", "/downloads", "Bayaan Download"],
  ["khulafa_bayaans.htm", "/khulafa-bayaans", "Bayaans by Khulafa"],
  ["silsila_geneology.htm", "/silsila", "Shajra of Silsila"],
  ["khulafa.htm", "/khulafa", "His Khulafa"],
  ["khulafa2.htm", "/khulafa-of-khulafa", "His Khulafa's Khulafa"],
  ["other_bayaans.htm", "/other-bayaans", "Other Bayaans"],
  ["naat_nazam_munajaat.htm", "/naat", "Naat, Nazam, Munaajat"],
  ["photo.htm", "/gallery", "Photo & Video Gallery"],
  ["links.htm", "/links", "Islamic Web Links"],
  ["prayer_times.htm", "/namaz", "Namaz & Times"],
  ["duaa_from_quraan.htm", "/duas", "Du'aas from Qur'aan"],
  ["islamic_prohibitions.htm", "/prohibitions", "Islamic Prohibitions"],
  ["contact_us.htm", "/contact", "Contact Me"],
];

const SPECIAL = {
  "hazrats_bayaan_index.htm": "/bayaans/full-index",
  "1987_program_page.htm": "/bayaans/1987-programme",
  "allamarafiq_bayaan_page.htm": "/bayaans/allama-rafiq",
  "duas_for_all_occassions.htm": "/duas/occasions",
};

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (/\.html?$/i.test(entry.name)) acc.push(full);
  }
  return acc;
}

function routeFor(filePath) {
  const normalized = decodeURIComponent(filePath.replace(/\\/g, "/")).replace(/^\.?\//, "");
  const base = path.posix.basename(normalized).toLowerCase();
  const known = NAV.find(([file]) => file.toLowerCase() === base);
  if (known) return known[1];
  if (SPECIAL[base]) return SPECIAL[base];
  const khalifa = base.match(/^khulafa_of_khalifa(\d+)\.htm$/);
  if (khalifa) return `/khulafa/khalifa-${khalifa[1]}`;
  if (/\.html?$/i.test(base)) {
    const slug = base
      .replace(/\.html?$/i, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase();
    const folder = path.posix.dirname(normalized);
    if (folder && folder !== ".") return `/pages/${folder.replace(/[^a-z0-9/]+/gi, "-").toLowerCase()}/${slug}`;
    return `/pages/${slug}`;
  }
  return null;
}

function publicUrl(relativePath) {
  const decoded = decodeURIComponent(relativePath.replace(/\\/g, "/")).replace(/^\.?\//, "");
  return `/archive/${decoded.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

function rewriteUrl(value) {
  if (!value) return value;
  const trimmed = value.trim();
  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("mailto:") || trimmed.startsWith("javascript:")) {
    return trimmed;
  }
  if (/^https?:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.hostname === "www.pirghulamhabib.com" || url.hostname === "pirghulamhabib.com") {
        const route = /\.html?$/i.test(url.pathname) ? routeFor(decodeURIComponent(url.pathname)) : null;
        if (route) return route + url.hash;
        return publicUrl(decodeURIComponent(url.pathname)) + url.search + url.hash;
      }
    } catch {
      return trimmed;
    }
    return trimmed;
  }

  const hashIndex = trimmed.indexOf("#");
  const beforeHash = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const hash = hashIndex >= 0 ? trimmed.slice(hashIndex) : "";
  const pathOnly = beforeHash.split("?")[0];
  if (/\.html?$/i.test(pathOnly)) {
    const route = routeFor(pathOnly);
    if (route) return route + hash;
  }
  if (!pathOnly) return hash || trimmed;
  return publicUrl(pathOnly) + hash;
}

function readHtml(file) {
  return new TextDecoder("windows-1252").decode(fs.readFileSync(file));
}

function plainText(value) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function roleFor(label) {
  const value = label.toLowerCase().replace(/[:.]+$/g, "").replace(/\s+/g, " ").trim();
  if (/^(cassette no|tape no|no)$/.test(value)) return "no";
  if (/^date( recorded)?$/.test(value)) return "date";
  if (/^(city and venue|city|venue|topic)$/.test(value)) return "place";
  if (/^name( of khalifa)?$/.test(value)) return "name";
  if (/^town$/.test(value)) return "town";
  if (/^(tape )?side$/.test(value)) return "side";
  if (/^duration$/.test(value)) return "time";
  if (/^size$/.test(value)) return "size";
  if (/^(listen|click to listen|download link)$/.test(value)) return "listen";
  return "extra";
}

function kindFrom(roles) {
  const rolesPresent = new Set(roles);
  if (rolesPresent.has("name")) return "people";
  if (rolesPresent.has("place") && rolesPresent.has("side")) return "bayaan";
  if (rolesPresent.has("listen") && rolesPresent.has("place")) return "extract";
  if (rolesPresent.has("listen") || rolesPresent.has("side")) return "download";
  return "plain";
}

function looksLikeHeader(labels) {
  if (labels.length < 2 || labels.some((label) => label.length === 0 || label.length > 40)) return false;
  const matched = labels.filter((label) => roleFor(label) !== "extra").length;
  return matched >= 2 && matched >= labels.length - 1;
}

function tableMatrix($, table) {
  const matrix = [];
  $(table)
    .find("tr")
    .toArray()
    .forEach((row, rowIndex) => {
      matrix[rowIndex] = matrix[rowIndex] || [];
      let column = 0;
      $(row)
        .children("td, th")
        .each((_, cell) => {
          while (matrix[rowIndex][column]) column += 1;
          const colspan = Math.max(1, parseInt($(cell).attr("colspan") || "1", 10) || 1);
          const rowspan = Math.max(1, parseInt($(cell).attr("rowspan") || "1", 10) || 1);
          for (let spanRow = 0; spanRow < rowspan; spanRow += 1) {
            matrix[rowIndex + spanRow] = matrix[rowIndex + spanRow] || [];
            for (let spanColumn = 0; spanColumn < colspan; spanColumn += 1) {
              matrix[rowIndex + spanRow][column + spanColumn] = cell;
            }
          }
          column += colspan;
        });
    });
  return matrix;
}

function uniqueCells(matrixRow) {
  const cells = [];
  let previous = null;
  for (const cell of matrixRow || []) {
    if (!cell || cell === previous) continue;
    previous = cell;
    cells.push(cell);
  }
  return cells;
}

function cellInfo($, cell) {
  const text = plainText($(cell).text());
  const hasMedia = $(cell).find("a, audio, img, video").length > 0;
  return { html: $(cell).html() || "", text, blank: !text && !hasMedia };
}

function isBanner($, cells) {
  return cells.some((cell) => {
    const span = parseInt($(cell).attr("colspan") || "1", 10) || 1;
    const background = ($(cell).attr("bgcolor") || "").toLowerCase();
    return span >= 3 || background === "#cccccc";
  });
}

function normalizeSheets($, root) {
  root.find("table[border='1']").each((_, table) => {
    const matrix = tableMatrix($, table);
    let headerLabels = null;
    for (const row of matrix) {
      const labels = uniqueCells(row).map((cell) => plainText($(cell).text()));
      if (looksLikeHeader(labels)) {
        headerLabels = labels;
        break;
      }
    }
    if (!headerLabels) return;

    const roles = headerLabels.map(roleFor);
    const sheet = $("<div></div>").addClass(`sheet kind-${kindFrom(roles)}`).attr("role", "table");
    const makeHead = () => {
      const head = $("<div></div>").addClass("sheet-head").attr("role", "row");
      headerLabels.forEach((label, index) => {
        head.append($("<div></div>").addClass(`f-${roles[index]}`).attr("role", "columnheader").text(label));
      });
      return head;
    };

    let pendingHead = false;
    matrix.forEach((row) => {
      const cells = uniqueCells(row);
      const labels = cells.map((cell) => plainText($(cell).text()));
      if (looksLikeHeader(labels)) return;
      if (isBanner($, cells)) {
        const banner = $("<div></div>").addClass("sheet-banner");
        cells.forEach((cell) => {
          const info = cellInfo($, cell);
          if (!info.blank) banner.append($("<div></div>").html(info.html));
        });
        if (banner.children().length) {
          sheet.append(banner);
          pendingHead = true;
        }
        return;
      }

      const infos = cells.map((cell) => cellInfo($, cell));
      if (infos.every((info) => info.blank)) return;
      if (pendingHead || sheet.find(".sheet-head").length === 0) {
        sheet.append(makeHead());
        pendingHead = false;
      }

      const record = $("<div></div>").addClass("sheet-row").attr("role", "row");
      infos.forEach((info, index) => {
        if (info.blank) return;
        const role = roles[index] || "extra";
        const label = headerLabels[index] || "";
        const field = $("<div></div>").addClass(`f-${role}`).attr("role", "cell");
        if (label) field.append($("<span></span>").addClass("field-label").text(label));
        field.append(info.html);
        record.append(field);
      });
      if (record.children().length) sheet.append(record);
    });

    if (sheet.find(".sheet-row").length) $(table).replaceWith(sheet);
  });
}

function extract(file) {
  const $ = cheerio.load(readHtml(file), { decodeEntities: false });
  const title = $("title").first().text().replace(/\s+/g, " ").trim();
  $("script, style, noscript").remove();

  const nav = $('img[name="MSFPnav1"]').first();
  const root = nav.length ? nav.closest("tr").children("td").last() : $("body");
  root.find("script, style, noscript").remove();
  root.find('img[alt="Hit Counter"]').remove();
  root.find("form").each((_, element) => {
    const action = ($(element).attr("action") || "").toLowerCase();
    if (action.includes("atmail") || action.includes("webmail") || $(element).find('input[name="password"]').length) {
      $(element).remove();
    }
  });
  root.find('input[name="password"], input[name="username"], input[name="MailServer"], input[name="MailType"], input[name="pop3hostexternal"], input[name="LoginType"], select[name="pop3host"]').remove();
  root.find("p, b, span, font").each((_, element) => {
    if (/^\s*email login:\s*$/i.test($(element).text())) $(element).remove();
  });
  if (path.basename(file).toLowerCase() === "contact_us.htm") {
    root.find("input, select, button").remove();
  }

  root.find("[href]").each((_, element) => {
    const href = $(element).attr("href");
    const next = rewriteUrl(href);
    if (next) $(element).attr("href", next);
    if ($(element).attr("target") === "_blank") $(element).attr("rel", "noopener noreferrer");
  });
  root.find("[src]").each((_, element) => {
    const src = rewriteUrl($(element).attr("src"));
    if (src) $(element).attr("src", src);
  });
  root.find("a[href]").each((_, element) => {
    const href = $(element).attr("href") || "";
    if (/\.mp3($|\?)/i.test(href)) {
      $(element).after(`<audio controls preload="none" src="${href}"></audio>`);
      $(element).text("Download");
    }
  });

  normalizeSheets($, root);

  const relative = path.relative(ARCHIVE, file).replace(/\\/g, "/");
  return {
    href: routeFor(relative),
    title: title || "Murshid-e-Alam",
    source: relative,
    html: (root.html() || "").trim(),
  };
}

const pages = [];
const seenHrefs = new Set();
for (const file of walk(ARCHIVE)) {
  if (path.basename(file).toLowerCase() === "index.htm" && path.dirname(file) !== ARCHIVE) continue;
  const page = extract(file);
  if (!page.href || !page.html || seenHrefs.has(page.href)) continue;
  seenHrefs.add(page.href);
  pages.push(page);
}

pages.sort((a, b) => a.href.localeCompare(b.href));
fs.mkdirSync(path.dirname(OUT_PAGES), { recursive: true });
fs.writeFileSync(OUT_PAGES, JSON.stringify(pages));

const redirects = pages
  .filter((page) => page.source && page.href)
  .map((page) => ({
    source: `/${page.source}`,
    destination: page.href,
    permanent: true,
  }));
fs.writeFileSync(OUT_REDIRECTS, JSON.stringify(redirects, null, 2));
console.log(`pages ${pages.length}`);
pages.forEach((page) => console.log(`${page.href} <- ${page.source}`));
