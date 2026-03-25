import { readFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer";

const cwd = process.cwd();
const server = Bun.serve({
  port: 0,
  async fetch(req) {
    let pathname = new URL(req.url).pathname.replace("/convert/", "") || "index.html";
    pathname = pathname.replaceAll("..", "");
    if (pathname.startsWith("/test/")) pathname = "../test/resources/" + pathname.slice(6);
    const file = Bun.file(path.join(cwd, "dist", pathname));
    if (!(await file.exists())) return new Response("Not Found", { status: 404 });
    return new Response(file);
  },
});

const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

const page = await browser.newPage();
page.on("console", (msg) => {
  console.log(`[page:${msg.type()}] ${msg.text()}`);
});
page.on("pageerror", (err) => {
  console.log(`[pageerror] ${err.stack || err.message}`);
});

await page.goto(`http://localhost:${server.port}/convert/index.html`);
await page.waitForFunction(() => window.tryConvertByTraversing !== undefined);

const epubBytes = new Uint8Array(await readFile(path.join(process.env.HOME, "Downloads", "The Little Prince.epub")));

const result = await page.evaluate(async (bytes) => {
  async function pickBytes() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';

      input.onchange = async () => {
        try {
          const file = input.files[0];
          if (!file) return reject(new Error('No file selected'));

          const buffer = await file.arrayBuffer();
          resolve(new Uint8Array(buffer));
        } catch (err) {
          reject(err);
        }
      };

      input.click();
    });
  }

  const findNode = (mime, format) => {
    const values = Array.from(window.supportedFormatCache.values()).flatMap((items) =>
      items.map((item) => ({ format: item, handlerName: "" })),
    );
    for (const [handlerName, items] of window.supportedFormatCache.entries()) {
      for (const item of items) {
        if (item.mime === mime && item.format === format) {
          return { format: item, handler: { name: handlerName, ready: true } };
        }
      }
    }
    return values.find((value) => value.format.mime === mime && value.format.format === format);
  };

  const from = findNode("application/epub+zip", "epub");
  const to = findNode("application/pdf", "pdf");

  if (!from || !to) {
    throw new Error(`Failed to find conversion nodes: from=${Boolean(from)} to=${Boolean(to)}`);
  }

  try {
    const conversion = await window.tryConvertByTraversing(
      [{ name: "The Little Prince.epub", bytes: await pickBytes() }],
      from,
      to,
    );
    return {
      ok: true,
      path: conversion?.path.map((node) => ({
        format: node.format.format,
        mime: node.format.mime,
        handler: node.handler.name,
      })),
      outputNames: conversion?.files.map((file) => file.name),
      outputSizes: conversion?.files.map((file) => file.bytes.length),
    };
  } catch (error) {
    return {
      ok: false,
      error: String(error),
      stack: error?.stack || null,
    };
  }
}, Array.from(epubBytes));

console.log(JSON.stringify(result, null, 2));

await browser.close();
server.stop(true);
