import {
	FileText, FileImage, FileAudio, FileVideo, FileArchive, FileCode,
	FileSpreadsheet, FileType, File, FileJson
} from "lucide-preact";
import "./index.css";

interface FileIconProps {
	extension?: string;
	mimeType?: string;
	size?: number;
	className?: string;
}

const ICON_MAP: Record<string, typeof File> = {
	png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage,
	bmp: FileImage, webp: FileImage, tiff: FileImage, ico: FileImage,
	svg: FileImage, avif: FileImage, qoi: FileImage,

	mp3: FileAudio, wav: FileAudio, ogg: FileAudio, flac: FileAudio,
	aac: FileAudio, wma: FileAudio, m4a: FileAudio, mid: FileAudio,
	midi: FileAudio,

	mp4: FileVideo, avi: FileVideo, mkv: FileVideo, mov: FileVideo,
	wmv: FileVideo, webm: FileVideo, flv: FileVideo,

	zip: FileArchive, tar: FileArchive, gz: FileArchive, "7z": FileArchive,
	rar: FileArchive, bz2: FileArchive, xz: FileArchive, zst: FileArchive,

	pdf: FileText, doc: FileText, docx: FileText, rtf: FileText,
	odt: FileText, epub: FileText, typ: FileText,

	xls: FileSpreadsheet, xlsx: FileSpreadsheet, csv: FileSpreadsheet,
	ods: FileSpreadsheet,

	pptx: FileText, ppt: FileText,

	ttf: FileType, otf: FileType, woff: FileType, woff2: FileType,

	json: FileJson, json5: FileJson,
	js: FileCode, ts: FileCode, py: FileCode, c: FileCode,
	cpp: FileCode, rs: FileCode, html: FileCode, css: FileCode,
	sh: FileCode, bat: FileCode, exe: FileCode,

	txt: FileText, md: FileText, markdown: FileText,
	xml: FileCode, yaml: FileCode, yml: FileCode, toml: FileCode,
	ini: FileCode,
};

const MIME_PREFIX_MAP: Record<string, typeof File> = {
	"image/": FileImage,
	"audio/": FileAudio,
	"video/": FileVideo,
	"font/": FileType,
	"text/": FileText,
};

function getIconComponent(extension?: string, mimeType?: string): typeof File {
	if (extension) {
		const ext = extension.toLowerCase().replace(/^\./, "");
		if (ICON_MAP[ext]) return ICON_MAP[ext];
	}

	if (mimeType) {
		for (const [prefix, icon] of Object.entries(MIME_PREFIX_MAP)) {
			if (mimeType.startsWith(prefix)) return icon;
		}
		if (mimeType.includes("zip") || mimeType.includes("archive") || mimeType.includes("compressed")) {
			return FileArchive;
		}
		if (mimeType.includes("json")) return FileJson;
	}

	return File;
}

export default function FileIcon({ extension, mimeType, size = 20, className = "" }: FileIconProps) {
	const IconComponent = getIconComponent(extension, mimeType);

	return (
		<div className={`file-icon ${className}`}>
			<IconComponent size={size} />
		</div>
	);
}
