import CommonFormats from "../CommonFormats.ts";
import type { FileData, FileFormat, FormatHandler } from "../FormatHandler.ts";

export default class HtmlToPdfHandler implements FormatHandler {
  public name: string = "html2pdf";
  public ready: boolean = false;

  public supportedFormats: FileFormat[] = [
    CommonFormats.HTML.supported("html2pdf", true, false),
    CommonFormats.PDF.supported("pdf", false, true),
  ];

  async init() {
    this.ready = true;
  }

  async doConvert(
    inputFiles: FileData[],
    _inputFormat: FileFormat,
    outputFormat: FileFormat,
  ): Promise<FileData[]> {
    if (!this.ready) throw new Error("Handler not initialized.");

    const [html2canvasModule, jsPDFModule] = await Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ]);
    const html2canvas = html2canvasModule.default ?? html2canvasModule;
    const { jsPDF } = jsPDFModule;

    const outputFiles: FileData[] = [];

    for (const file of inputFiles) {
      const baseName = file.name.replace(/\.[^.]+$/u, "");

      if (outputFormat.internal === "pdf") {
         const htmlText = new TextDecoder().decode(file.bytes);

         const iframe = document.createElement('iframe');
         iframe.style.position = 'fixed';
         iframe.style.left = '-10000px';
         iframe.style.top = '0';
         iframe.style.width = '816px';
         iframe.style.height = '1056px';
         iframe.style.border = 'none';
         document.body.appendChild(iframe);

         const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
         if (!iframeDoc) throw new Error("Could not access iframe document.");

         iframeDoc.open();
         iframeDoc.write(htmlText);
         iframeDoc.close();

         await new Promise<void>(resolve => {
           if (iframeDoc.readyState === 'complete') {
             resolve();
           } else {
             iframe.addEventListener('load', () => resolve(), { once: true });
           }
         });

         await new Promise(resolve => setTimeout(resolve, 300));

         try {
             const canvas = await (html2canvas as any)(iframeDoc.body, {
               scale: 2,
               useCORS: true,
               logging: false,
               width: 816,
               windowWidth: 816,
             });

             const MARGIN_IN = 0.5;
             const DPI = 72;
             const PAGE_W_IN = 8.5;
             const PAGE_H_IN = 11;
             const INNER_W = PAGE_W_IN - MARGIN_IN * 2;
             const INNER_H = PAGE_H_IN - MARGIN_IN * 2;
             const INNER_RATIO = INNER_H / INNER_W;

             const pxPageHeight = Math.floor(canvas.width * INNER_RATIO);
             const totalPages = Math.ceil(canvas.height / pxPageHeight);

             const pdf = new jsPDF({
               unit: 'in',
               format: 'letter',
               orientation: 'portrait',
             });

             const pageCanvas = document.createElement('canvas');
             const pageCtx = pageCanvas.getContext('2d')!;
             pageCanvas.width = canvas.width;

             for (let page = 0; page < totalPages; page++) {
               const isLastPage = page === totalPages - 1;
               const sliceHeight = isLastPage && canvas.height % pxPageHeight !== 0
                 ? canvas.height % pxPageHeight
                 : pxPageHeight;

               pageCanvas.height = sliceHeight;
               pageCtx.fillStyle = 'white';
               pageCtx.fillRect(0, 0, pageCanvas.width, sliceHeight);
               pageCtx.drawImage(
                 canvas,
                 0, page * pxPageHeight, canvas.width, sliceHeight,
                 0, 0, canvas.width, sliceHeight,
               );

               if (page > 0) pdf.addPage();

               const imgData = pageCanvas.toDataURL('image/jpeg', 0.98);
               const pageHeight = isLastPage
                 ? sliceHeight * INNER_W / canvas.width
                 : INNER_H;

               pdf.addImage(imgData, 'JPEG', MARGIN_IN, MARGIN_IN, INNER_W, pageHeight);
             }

             const pdfBuffer = pdf.output('arraybuffer');
             outputFiles.push({
               name: `${baseName}.pdf`,
               bytes: new Uint8Array(pdfBuffer),
             });
         } catch (e) {
             console.error("Failed to convert HTML to PDF", e);
             throw new Error("Failed to convert HTML to PDF: " + (e as Error).message);
         } finally {
             iframe.remove();
         }
      }
    }

    return outputFiles;
  }
}
