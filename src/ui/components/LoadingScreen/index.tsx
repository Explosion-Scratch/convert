import { Loader2, ArrowRight } from "lucide-preact";
import type { FileFormat } from "src/FormatHandler";
import FileIcon from "src/ui/components/FileIcon";
import FileInfoBadge from "src/ui/components/FileInfo";
import "./index.css";

interface LoadingScreenProps {
	fileName: string;
	fileSize?: number;
	from?: FileFormat;
	to?: FileFormat;
	statusText?: string;
}

export default function LoadingScreen({
	fileName,
	fileSize,
	from,
	to,
	statusText = "Finding conversion route...",
}: LoadingScreenProps) {
	const fromExt = from?.extension?.toUpperCase();
	const toExt = to?.extension?.toUpperCase();

	return (
		<div className="loading-screen">
			<div className="loading-spinner-wrap">
				<Loader2 size={40} className="loading-spinner" />
			</div>

			<h2 className="loading-title">{statusText}</h2>

			<div className="loading-conversion-info">
				{from && (
					<div className="loading-format-pill" aria-hidden="true">
						<FileIcon
							extension={from.extension}
							mimeType={from.mime}
							category={from.category}
							size={18}
						/>
						<span className="loading-format-ext">.{fromExt}</span>
					</div>
				)}
				{from && to && (
					<ArrowRight size={24} className="loading-arrow" aria-hidden="true" />
				)}
				{to && (
					<div className="loading-format-pill" aria-hidden="true">
						<FileIcon
							extension={to.extension}
							mimeType={to.mime}
							category={to.category}
							size={18}
						/>
						<span className="loading-format-ext">.{toExt}</span>
					</div>
				)}
			</div>

			<div className="loading-file-info">
				<FileInfoBadge
					fileName={fileName}
					fileSize={fileSize}
					extension={from?.extension}
				/>
			</div>
		</div>
	);
}
