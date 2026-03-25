import satori, { type Font } from "satori";
import { html } from "satori-html";
import notoSansBoldUrl from "@fontsource/noto-sans/files/noto-sans-latin-700-normal.woff?url";
import notoSansRegularUrl from "@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff?url";

export interface HtmlSnapshot {
  html: string;
  width: number;
  height: number;
}

export interface HtmlSnapshotOptions {
  width?: number;
  height?: number;
  backgroundColor?: string;
}

let fontPromise: Promise<Font[]> | undefined;

function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(blob);
  });
}

async function urlToDataUrl(
  url: string,
  cache: Map<string, string>,
): Promise<string> {
  if (!url || url.startsWith("data:") || url.startsWith("#")) return url;

  const cached = cache.get(url);
  if (cached) return cached;

  try {
    const response = await fetch(url);
    if (!response.ok) return url;
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    cache.set(url, dataUrl);
    return dataUrl;
  } catch {
    return url;
  }
}

async function rewriteCssUrls(
  value: string,
  cache: Map<string, string>,
): Promise<string> {
  const matches = Array.from(value.matchAll(/url\((['"]?)(.*?)\1\)/gu));
  if (matches.length === 0) return value;

  let result = value;
  for (const match of matches) {
    const rawUrl = match[2]?.trim();
    if (!rawUrl) continue;
    const dataUrl = await urlToDataUrl(rawUrl, cache);
    result = result.replace(match[0], `url("${dataUrl}")`);
  }

  return result;
}

async function loadFonts(): Promise<Font[]> {
  if (!fontPromise) {
    fontPromise = Promise.all([
      fetch(notoSansRegularUrl).then(async response => await response.arrayBuffer()),
      fetch(notoSansBoldUrl).then(async response => await response.arrayBuffer()),
    ]).then(([regular, bold]) => [
      {
        name: "Noto Sans",
        data: regular,
        weight: 400,
        style: "normal",
      },
      {
        name: "Noto Sans",
        data: bold,
        weight: 700,
        style: "normal",
      },
    ]);
  }

  return await fontPromise;
}

async function waitForRenderableAssets(root: ParentNode): Promise<void> {
  const pendingImages = Array.from(root.querySelectorAll("img"))
    .filter(image => !image.complete)
    .map(image => new Promise<void>(resolve => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    }));

  const pendingVideos = Array.from(root.querySelectorAll("video"))
    .filter(video => video.readyState < 2)
    .map(video => new Promise<void>(resolve => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener("error", () => resolve(), { once: true });
    }));

  await Promise.all([...pendingImages, ...pendingVideos]);
  await nextPaint();
}

function createElementClone(source: Element): Element {
  const tagName = source.tagName;
  if (source.namespaceURI) {
    return document.createElementNS(source.namespaceURI, tagName);
  }
  return document.createElement(tagName.toLowerCase());
}

function measureRenderedElement(
  element: Element,
  options: HtmlSnapshotOptions,
): { width: number; height: number } {
  const rect = element.getBoundingClientRect();
  const widthCandidate = element instanceof HTMLElement || element instanceof SVGElement
    ? Math.max(rect.width, element.scrollWidth || 0, element.clientWidth || 0)
    : rect.width;
  const heightCandidate = element instanceof HTMLElement || element instanceof SVGElement
    ? Math.max(rect.height, element.scrollHeight || 0, element.clientHeight || 0)
    : rect.height;

  return {
    width: Math.max(1, Math.ceil(options.width ?? widthCandidate)),
    height: Math.max(1, Math.ceil(options.height ?? heightCandidate)),
  };
}

async function copyRenderedNode(
  sourceNode: Node,
  cache: Map<string, string>,
): Promise<Node | null> {
  if (sourceNode.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(sourceNode.textContent ?? "");
  }

  if (!(sourceNode instanceof Element)) return null;
  if (sourceNode instanceof HTMLScriptElement) return null;
  if (sourceNode instanceof HTMLStyleElement) return null;
  if (sourceNode instanceof HTMLLinkElement) return null;

  const clone = createElementClone(sourceNode);

  for (const attribute of Array.from(sourceNode.attributes)) {
    if (attribute.name === "style" || attribute.name === "class") continue;
    if (attribute.name.startsWith("on")) continue;

    let value = attribute.value;
    if (["src", "href", "poster", "xlink:href"].includes(attribute.name)) {
      value = await urlToDataUrl(value, cache);
    }

    if (attribute.namespaceURI) {
      clone.setAttributeNS(attribute.namespaceURI, attribute.name, value);
    } else {
      clone.setAttribute(attribute.name, value);
    }
  }

  const computedStyle = getComputedStyle(sourceNode);
  const declarations: string[] = [];
  for (const property of Array.from(computedStyle)) {
    const value = computedStyle.getPropertyValue(property);
    if (!value) continue;
    const finalValue = property.includes("image")
      || property === "mask"
      || property === "mask-image"
      || property === "-webkit-mask-image"
      ? await rewriteCssUrls(value, cache)
      : value;
    declarations.push(`${property}:${finalValue};`);
  }

  if (sourceNode instanceof HTMLImageElement) {
    const src = sourceNode.currentSrc || sourceNode.src;
    if (src) clone.setAttribute("src", await urlToDataUrl(src, cache));
    const rect = sourceNode.getBoundingClientRect();
    clone.setAttribute("width", String(Math.max(1, Math.round(rect.width || sourceNode.width || 1))));
    clone.setAttribute("height", String(Math.max(1, Math.round(rect.height || sourceNode.height || 1))));
  }

  if (sourceNode instanceof HTMLCanvasElement) {
    const image = document.createElement("img");
    const rect = sourceNode.getBoundingClientRect();
    image.setAttribute("src", sourceNode.toDataURL("image/png"));
    image.setAttribute("width", String(Math.max(1, Math.round(rect.width || sourceNode.width || 1))));
    image.setAttribute("height", String(Math.max(1, Math.round(rect.height || sourceNode.height || 1))));
    image.setAttribute("style", declarations.join(""));
    return image;
  }

  if (sourceNode instanceof HTMLVideoElement && sourceNode.poster) {
    const image = document.createElement("img");
    const rect = sourceNode.getBoundingClientRect();
    image.setAttribute("src", await urlToDataUrl(sourceNode.poster, cache));
    image.setAttribute("width", String(Math.max(1, Math.round(rect.width || sourceNode.clientWidth || 1))));
    image.setAttribute("height", String(Math.max(1, Math.round(rect.height || sourceNode.clientHeight || 1))));
    image.setAttribute("style", declarations.join(""));
    return image;
  }

  if (declarations.length > 0) {
    clone.setAttribute("style", declarations.join(""));
  }

  for (const childNode of Array.from(sourceNode.childNodes)) {
    const childClone = await copyRenderedNode(childNode, cache);
    if (childClone) clone.appendChild(childClone);
  }

  return clone;
}

export async function snapshotElementToStaticHtml(
  element: Element,
  options: HtmlSnapshotOptions = {},
): Promise<HtmlSnapshot> {
  await waitForRenderableAssets(element);

  const { width, height } = measureRenderedElement(element, options);
  const cloned = await copyRenderedNode(element, new Map<string, string>());
  if (!(cloned instanceof Element)) {
    throw new Error("Failed to serialize rendered HTML.");
  }

  const existingStyle = cloned.getAttribute("style") || "";
  const backgroundColor = options.backgroundColor ? `background-color:${options.backgroundColor};` : "";
  cloned.setAttribute(
    "style",
    `${existingStyle}${backgroundColor}width:${width}px;height:${height}px;`,
  );

  return {
    html: cloned.outerHTML,
    width,
    height,
  };
}

export async function snapshotHtmlToStaticHtml(
  htmlContent: string,
  options: HtmlSnapshotOptions = {},
): Promise<HtmlSnapshot> {
  const parsed = new DOMParser().parseFromString(htmlContent, "text/html");
  const host = document.createElement("div");
  host.style.all = "initial";
  host.style.position = "fixed";
  host.style.left = "-20000px";
  host.style.top = "0";
  host.style.pointerEvents = "none";
  host.style.background = "transparent";
  document.body.appendChild(host);

  try {
    const shadow = host.attachShadow({ mode: "closed" });
    const reset = document.createElement("style");
    reset.textContent = `
      :host {
        all: initial;
      }
      .convert-html-root {
        display: inline-block;
        position: relative;
        box-sizing: border-box;
      }
    `;
    shadow.appendChild(reset);

    for (const styleElement of Array.from(parsed.querySelectorAll("style"))) {
      shadow.appendChild(styleElement.cloneNode(true));
    }

    const root = document.createElement("div");
    root.className = "convert-html-root";
    const bodyStyle = parsed.body.getAttribute("style");
    if (bodyStyle) root.setAttribute("style", bodyStyle);

    const sourceNodes = parsed.body.childNodes.length > 0
      ? Array.from(parsed.body.childNodes)
      : Array.from(parsed.documentElement.childNodes);
    for (const childNode of sourceNodes) {
      root.appendChild(childNode.cloneNode(true));
    }

    shadow.appendChild(root);
    return await snapshotElementToStaticHtml(root, options);
  } finally {
    host.remove();
  }
}

export async function renderHtmlToSvg(
  htmlContent: string,
  options: HtmlSnapshotOptions = {},
): Promise<string> {
  const snapshot = await snapshotHtmlToStaticHtml(htmlContent, options);
  return await renderStaticHtmlToSvg(snapshot);
}

export async function renderElementToSvg(
  element: Element,
  options: HtmlSnapshotOptions = {},
): Promise<string> {
  const snapshot = await snapshotElementToStaticHtml(element, options);
  return await renderStaticHtmlToSvg(snapshot);
}

export async function renderStaticHtmlToSvg(snapshot: HtmlSnapshot): Promise<string> {
  const fonts = await loadFonts();

  return await satori(html(snapshot.html), {
    width: snapshot.width,
    height: snapshot.height,
    fonts,
  });
}
