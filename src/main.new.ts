import type { FileFormat, FileData, FormatHandler, ConvertPathNode } from "./FormatHandler.js";
import handlers from "./handlers";
import { TraversionGraph } from "./TraversionGraph.js";
import { CurrentPage, LoadingToolsText, Pages, PopupData } from "./ui/AppState.js";
import { signal } from "@preact/signals";
import { Mode, ModeEnum } from "./ui/ModeStore.js";

type FileRecord = Record<`${string}-${string}`, File>;

export type ConversionOptionsMap = Map<FileFormat, FormatHandler>;
export type ConversionOption = ConversionOptionsMap extends Map<infer K, infer V> ? [K, V] : never;

export const ConversionOptions: ConversionOptionsMap = new Map();

export const SelectedFiles = signal<FileRecord>({});

export function goToUploadHome(): void {
	CurrentPage.value = Pages.Upload;
	SelectedFiles.value = {};
}

export const ConversionsFromAnyInput: ConvertPathNode[] =
	handlers
		.filter(h => h.supportAnyInput && h.supportedFormats)
		.flatMap(h => h.supportedFormats!
			.filter(f => f.to)
			.map(f => ({ handler: h, format: f })));

window.supportedFormatCache = new Map();
window.traversionGraph = new TraversionGraph();

window.printSupportedFormatCache = () => {
	const entries = [];
	for (const entry of window.supportedFormatCache)
		entries.push(entry);
	return JSON.stringify(entries, null, 2);
};

async function buildOptionList() {
	ConversionOptions.clear();

	for (const handler of handlers) {
		if (!window.supportedFormatCache.has(handler.name)) {
			console.warn(`Cache miss for formats of handler "${handler.name}"`);

			try {
				await handler.init();
			} catch (_) { continue; }

			if (handler.supportedFormats) {
				window.supportedFormatCache.set(handler.name, handler.supportedFormats);
				console.info(`Updated supported format cache for "${handler.name}"`);
			}
		}

		const supportedFormats = window.supportedFormatCache.get(handler.name);

		if (!supportedFormats) {
			console.warn(`Handler "${handler.name}" doesn't support any formats`);
			continue;
		}

		for (const format of supportedFormats) {
			if (!format.mime) continue;
			ConversionOptions.set(format, handler);
		}
	}

	window.traversionGraph.init(window.supportedFormatCache, handlers);
	LoadingToolsText.value = undefined;
}

let deadEndAttempts: ConvertPathNode[][];

async function attemptConvertPath(files: FileData[], path: ConvertPathNode[]) {
	const pathString = path.map(c => c.format.format).join(" → ");

	for (const deadEnd of deadEndAttempts) {
		let isDeadEnd = true;
		for (let i = 0; i < deadEnd.length; i++) {
			if (path[i] === deadEnd[i]) continue;
			isDeadEnd = false;
			break;
		}
		if (isDeadEnd) {
			const deadEndString = deadEnd.slice(-2).map(c => c.format.format).join(" → ");
			console.warn(`Skipping ${pathString} due to dead end near ${deadEndString}.`);
			return null;
		}
	}

	PopupData.value = {
		title: "Finding conversion route...",
		text: `Trying ${pathString}`,
		dismissible: false,
	};

	for (let i = 0; i < path.length - 1; i++) {
		const handler = path[i + 1].handler;

		try {
			let supportedFormats = window.supportedFormatCache.get(handler.name);

			if (!handler.ready) {
				await handler.init();
				if (!handler.ready) throw `Handler "${handler.name}" not ready after init.`;
				if (handler.supportedFormats) {
					window.supportedFormatCache.set(handler.name, handler.supportedFormats);
					supportedFormats = handler.supportedFormats;
				}
			}

			if (!supportedFormats) throw `Handler "${handler.name}" doesn't support any formats.`;

			const inputFormat = supportedFormats.find(c =>
				c.from
				&& c.mime === path[i].format.mime
				&& c.format === path[i].format.format
			) || (handler.supportAnyInput ? path[i].format : undefined);

			if (!inputFormat) throw `Handler "${handler.name}" doesn't support the "${path[i].format.format}" format.`;

			files = (await Promise.all([
				handler.doConvert(files, inputFormat, path[i + 1].format),
				new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
			]))[0];

			if (files.some(c => !c.bytes.length)) throw "Output is empty.";
		} catch (e) {
			console.log(path.map(c => c.format.format));
			console.error(handler.name, `${path[i].format.format} → ${path[i + 1].format.format}`, e);

			const deadEndPath = path.slice(0, i + 2);
			deadEndAttempts.push(deadEndPath);
			window.traversionGraph.addDeadEndPath(path.slice(0, i + 2));

			await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
			return null;
		}
	}

	return { files, path };
}

window.tryConvertByTraversing = async function (
	files: FileData[],
	from: ConvertPathNode,
	to: ConvertPathNode
) {
	deadEndAttempts = [];
	window.traversionGraph.clearDeadEndPaths();
	for await (const path of window.traversionGraph.searchPath(from, to, Mode.value === ModeEnum.Simple)) {
		if (path.at(-1)?.handler === to.handler) {
			path[path.length - 1] = to;
		}
		const attempt = await attemptConvertPath(files, path);
		if (attempt) return attempt;
	}
	return null;
};

function downloadFile(bytes: Uint8Array, name: string, mime: string) {
	const blob = new Blob([bytes as BlobPart], { type: mime });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = name;
	link.click();
}

async function initSupportedFormats() {
	try {
		try {
			const cacheJSON = await fetch("cache.json").then(r => r.json());
			window.supportedFormatCache = new Map(cacheJSON);
		} catch {
			console.warn(
				"Missing supported format precache.\n\n" +
				"Consider saving the output of printSupportedFormatCache() to cache.json."
			);
		}
		await buildOptionList();
		console.log("Built initial format list.");
	} catch (e) {
		console.error(e);
		LoadingToolsText.value = "Could not load formats.";
	}
}

void initSupportedFormats();

console.debug(ConversionOptions);
