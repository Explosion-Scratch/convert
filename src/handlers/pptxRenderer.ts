import {
  buildPresentation,
  parseZip,
  renderSlide,
} from "@aiden0z/pptx-renderer";
import CommonFormats from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import type { ConvertContext } from "../progress.ts";
import TypstHandler from "./typst.ts";
import { bundleTypstAssets } from "./pandoc.ts";
import {
  renderElementToSvg,
  snapshotElementToStaticHtml,
  type HtmlSnapshot,
} from "./htmlToSvg.ts";

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
  return Uint8Array.from(bytes).buffer;
}

function buildStandaloneSlideHtml(snapshot: HtmlSnapshot): string {
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8">',
    "</head>",
    '<body style="margin:0;background:#ffffff;">',
    snapshot.html,
    "</body>",
    "</html>",
  ].join("");
}

function pxToInches(px: number): string {
  return `${(px / 96).toFixed(4)}in`;
}

function createSlideTypst(
  slidePaths: string[],
  presentationWidth: number,
  presentationHeight: number,
): string {
  const pageWidth = pxToInches(presentationWidth);
  const pageHeight = pxToInches(presentationHeight);
  const pages = slidePaths.map((path, index) => [
    `#image("${path}", width: 100%, height: 100%)`,
    index < slidePaths.length - 1 ? "#pagebreak()" : "",
  ].filter(Boolean).join("\n")).join("\n\n");

  return [
    `#set page(width: ${pageWidth}, height: ${pageHeight}, margin: 0pt)`,
    "",
    pages,
  ].join("\n");
}

export default class PptxRendererHandler implements FormatHandler {
  public name: string = "pptx-renderer";

  public ready: boolean = true;

  public supportedFormats: FileFormat[] = [
    CommonFormats.PPTX.supported("pptx", true, false),
    CommonFormats.HTML.supported("html", false, true, true),
    CommonFormats.SVG.supported("svg", false, true),
    CommonFormats.PDF.supported("pdf", false, true),
  ];

  private typstHandler?: TypstHandler;

  async init() {
    this.ready = true;
  }

  private async getTypstHandler(): Promise<TypstHandler> {
    if (!this.typstHandler) {
      this.typstHandler = new TypstHandler();
      await this.typstHandler.init();
    }

    return this.typstHandler;
  }

  async doConvert(
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat,
    _args?: string[],
    ctx?: ConvertContext,
  ): Promise<FileData[]> {
    if (!this.ready) throw new Error("Handler not initialized.");
    if (
      inputFormat.internal !== "pptx"
      || !["html", "svg", "pdf"].includes(outputFormat.internal)
    ) {
      throw new Error("Invalid conversion requested.");
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
      for (const [fileIndex, inputFile] of inputFiles.entries()) {
        const progressBase = fileIndex / Math.max(inputFiles.length, 1);
        ctx?.progress(`Parsing ${inputFile.name}...`, progressBase);
        ctx?.log(`Parsing ${inputFile.name} with pptx-renderer...`);

        const files = await parseZip(toArrayBuffer(inputFile.bytes));
        const presentation = buildPresentation(files);

        if (presentation.slides.length === 0) {
          throw new Error(`${inputFile.name} does not contain any slides.`);
        }

        const pageFormat: [number, number] = [presentation.width, presentation.height];
        const mediaUrlCache = new Map<string, string>();
        const baseName = inputFile.name.replace(/\.[^.]+$/u, "");
        const slideHtmlSnapshots: HtmlSnapshot[] = [];
        const slideSvgs: { name: string; svg: string }[] = [];

        for (const [slideIndex, slide] of presentation.slides.entries()) {
          const slideLabel = `Rendering slide ${slideIndex + 1}/${presentation.slides.length} from ${inputFile.name}...`;
          const fileProgress = (slideIndex + 1) / presentation.slides.length;
          ctx?.progress(
            slideLabel,
            progressBase + fileProgress / Math.max(inputFiles.length, 1),
          );
          ctx?.log(`${slideLabel} (PPTX -> HTML)`);

          const handle = renderSlide(presentation, slide, { mediaUrlCache });
          try {
            stagingRoot.replaceChildren();
            stagingRoot.style.width = `${presentation.width}px`;
            stagingRoot.style.height = `${presentation.height}px`;
            stagingRoot.appendChild(handle.element);

            await waitForSlideToSettle(handle.element);
            const snapshot = await snapshotElementToStaticHtml(handle.element, {
              width: presentation.width,
              height: presentation.height,
              backgroundColor: "#ffffff",
            });
            slideHtmlSnapshots.push(snapshot);

            if (outputFormat.internal === "svg" || outputFormat.internal === "pdf") {
              ctx?.log(`Converting slide ${slideIndex + 1}/${presentation.slides.length} to SVG...`);
              const svg = await renderElementToSvg(handle.element, {
                width: presentation.width,
                height: presentation.height,
                backgroundColor: "#ffffff",
              });
              slideSvgs.push({
                name: `${baseName}.slide-${String(slideIndex + 1).padStart(2, "0")}.svg`,
                svg,
              });
            }
          } finally {
            stagingRoot.replaceChildren();
            handle.dispose();
          }
        }

        if (outputFormat.internal === "html") {
          for (const [slideIndex, snapshot] of slideHtmlSnapshots.entries()) {
            outputFiles.push({
              name: `${baseName}.slide-${String(slideIndex + 1).padStart(2, "0")}.html`,
              bytes: new TextEncoder().encode(buildStandaloneSlideHtml(snapshot)),
            });
          }
        } else if (outputFormat.internal === "svg") {
          for (const slide of slideSvgs) {
            outputFiles.push({
              name: slide.name,
              bytes: new TextEncoder().encode(slide.svg),
            });
          }
        } else {
          ctx?.log(`Building Typst document from slide SVGs for ${inputFile.name}...`);
          const assetFiles = Object.fromEntries(
            slideSvgs.map((slide, slideIndex) => [
              `slides/slide-${String(slideIndex + 1).padStart(2, "0")}.svg`,
              new Blob([slide.svg], { type: "image/svg+xml" }),
            ]),
          );
          const typstSource = createSlideTypst(
            Object.keys(assetFiles),
            pageFormat[0],
            pageFormat[1],
          );
          const bundledTypst = await bundleTypstAssets(typstSource, assetFiles);
          const typstHandler = await this.getTypstHandler();
          const [pdfFile] = await typstHandler.doConvert(
            [{
              name: `${baseName}.typ`,
              bytes: new TextEncoder().encode(bundledTypst),
            }],
            CommonFormats.TYPST.supported("typst", true, false),
            CommonFormats.PDF.supported("pdf", false, true),
          );
          outputFiles.push({
            name: `${baseName}.pdf`,
            bytes: pdfFile.bytes,
          });
        }

        for (const blobUrl of mediaUrlCache.values()) {
          URL.revokeObjectURL(blobUrl);
        }
      }
    } finally {
      stagingRoot.remove();
    }

    return outputFiles;
  }
}
