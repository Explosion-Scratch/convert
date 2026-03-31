import {
  buildPresentation,
  parseZip,
  renderSlide,
} from "@aiden0z/pptx-renderer";
import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import type { ConvertContext } from "../ui/ProgressStore.js";
import svgForeignObjectHandler from "./svgForeignObject.ts";
import {
  TYPST_ASSET_MANIFEST_START,
  TYPST_ASSET_MANIFEST_END,
} from "./pandoc.ts";

async function waitForSlideToSettle(element: HTMLElement): Promise<void> {
  const imagePromises = Array.from(element.querySelectorAll("img"))
    .filter(image => !image.complete)
    .map(image => new Promise<void>(resolve => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    }));

  await Promise.all(imagePromises);
  await new Promise<void>(resolve => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
  await new Promise(resolve => setTimeout(resolve, 100));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const sliced = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return sliced as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCodePoint(...chunk);
  }
  return btoa(binary);
}

export default class PptxRendererHandler implements FormatHandler {
  public name: string = "pptx-renderer";

  public ready: boolean = true;

  public supportedFormats: FileFormat[] = [
    CommonFormats.PPTX.supported("pptx", true, false),
    CommonFormats.SVG.supported("svg", false, true),
    CommonFormats.TYPST.supported("typst", false, true),
  ];

  async init() {
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
    _args?: string[],
    ctx?: ConvertContext,
  ): Promise<FileData[]> {
    if (!this.ready) throw new Error("Handler not initialized.");
    if (inputFormat.internal !== "pptx") {
      throw new Error("Invalid input format.");
    }

    const outputFiles: FileData[] = [];
    const stagingRoot = document.createElement("div");
    stagingRoot.style.position = "fixed";
    stagingRoot.style.left = "-20000px";
    stagingRoot.style.top = "0";
    stagingRoot.style.pointerEvents = "none";
    stagingRoot.style.background = "#ffffff";
    stagingRoot.style.zIndex = "-1";
    document.body.appendChild(stagingRoot);

    try {
      for (const inputFile of inputFiles) {
        ctx?.log(`Parsing ${inputFile.name}...`);
        ctx?.progress("Parsing PPTX...", 0);
        const files = await parseZip(toArrayBuffer(inputFile.bytes));
        const presentation = buildPresentation(files);

        if (presentation.slides.length === 0) {
          throw new Error(`${inputFile.name} does not contain any slides.`);
        }

        const totalSlides = presentation.slides.length;
        ctx?.log(`Found ${totalSlides} slides (${presentation.width}×${presentation.height}px)`);
        const mediaUrlCache = new Map<string, string>();
        const slideSvgs: string[] = [];

        for (const [slideIndex, slide] of presentation.slides.entries()) {
          ctx?.throwIfAborted();
          ctx?.progress(`Rendering slide ${slideIndex + 1}/${totalSlides}...`, slideIndex / totalSlides * 0.8);
          ctx?.log(`Rendering slide ${slideIndex + 1}/${totalSlides}...`);

          const handle = renderSlide(presentation, slide, { mediaUrlCache });
          try {
            stagingRoot.replaceChildren();
            stagingRoot.style.width = `${presentation.width}px`;
            stagingRoot.style.height = `${presentation.height}px`;
            stagingRoot.appendChild(handle.element);

            await waitForSlideToSettle(handle.element);

            const slideHtml = handle.element.outerHTML;
            const wrappedHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0;padding:0;overflow:hidden}*{box-sizing:border-box}</style></head><body style="width:${presentation.width}px;height:${presentation.height}px;">${slideHtml}</body></html>`;

            const { xml, bbox } = await svgForeignObjectHandler.normalizeHTML(wrappedHtml);
            const svgWidth = Math.max(bbox.width, presentation.width);
            const svgHeight = Math.max(bbox.height, presentation.height);
            const svgString = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg"><foreignObject x="0" y="0" width="${svgWidth}" height="${svgHeight}">${xml}</foreignObject></svg>`;
            slideSvgs.push(svgString);
          } finally {
            stagingRoot.replaceChildren();
            handle.dispose();
          }
        }

        const baseName = inputFile.name.replace(/\.[^.]+$/u, "");

        if (outputFormat.internal === "svg") {
          ctx?.progress("Writing SVG files...", 0.9);
          for (let si = 0; si < slideSvgs.length; si++) {
            const svgName = slideSvgs.length === 1
              ? `${baseName}.svg`
              : `${baseName}_slide${si + 1}.svg`;
            outputFiles.push({
              name: svgName,
              bytes: new TextEncoder().encode(slideSvgs[si]),
            });
          }
          ctx?.progress("Conversion complete!", 1);
          ctx?.log(`Generated ${slideSvgs.length} SVG files`);

        } else if (outputFormat.internal === "typst") {
          ctx?.progress("Building Typst document...", 0.85);
          ctx?.log("Assembling Typst document with SVG slides...");

          const typstParts: string[] = [
            '#set page(width: auto, height: auto, margin: 0pt)',
            '',
          ];

          const shadowFiles: Record<string, Uint8Array> = {};
          for (let si = 0; si < slideSvgs.length; si++) {
            const svgFileName = `slide_${si + 1}.svg`;
            shadowFiles[svgFileName] = new TextEncoder().encode(slideSvgs[si]);
            if (si > 0) {
              typstParts.push('#pagebreak()');
            }
            typstParts.push(`#image("${svgFileName}")`);
          }

          const typstContent = typstParts.join('\n');

          const bundledAssets = Object.fromEntries(
            Object.entries(shadowFiles).map(([path, bytes]) => [path, bytesToBase64(bytes)]),
          );

          const bundledTypst = [
            TYPST_ASSET_MANIFEST_START,
            `// ${JSON.stringify(bundledAssets)}`,
            TYPST_ASSET_MANIFEST_END,
            "",
            typstContent,
          ].join("\n");

          ctx?.progress("Typst document ready", 0.95);
          outputFiles.push({
            name: `${baseName}.typ`,
            bytes: new TextEncoder().encode(bundledTypst),
          });

          ctx?.progress("Conversion complete!", 1);
          ctx?.log("Typst document with embedded SVG slides ready for PDF compilation");
        }
      }
    } finally {
      stagingRoot.remove();
    }

    return outputFiles;
  }
}
