import CommonFormats, { Category } from "src/CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";
import { renderHtmlToSvg } from "./htmlToSvg.ts";

class svgForeignObjectHandler implements FormatHandler {

  public name: string = "satori-html";

  public supportedFormats: FileFormat[] = [
    CommonFormats.HTML.supported("html", true, false),
    // This preserves rendered appearance well, but it turns a document into an image-like artifact.
    CommonFormats.SVG.supported("svg", false, true, false, {
      category: [Category.IMAGE, Category.VECTOR],
    })
  ];

  public ready: boolean = true;

  async init () {
    this.ready = true;
  }

  async doConvert (
    inputFiles: FileData[],
    inputFormat: FileFormat,
    outputFormat: FileFormat
  ): Promise<FileData[]> {

    if (inputFormat.internal !== "html") throw "Invalid input format.";
    if (outputFormat.internal !== "svg") throw "Invalid output format.";

    const outputFiles: FileData[] = [];

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    for (const inputFile of inputFiles) {
      const { name, bytes } = inputFile;
      const html = decoder.decode(bytes);
      const svg = await renderHtmlToSvg(html);
      const outputBytes = encoder.encode(svg);
      const newName = (name.endsWith(".html") ? name.slice(0, -5) : name) + ".svg";
      outputFiles.push({ name: newName, bytes: outputBytes });
    }

    return outputFiles;

  }

}

export default svgForeignObjectHandler;
