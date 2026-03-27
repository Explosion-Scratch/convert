import { Loader2, ArrowRight } from "lucide-preact";
import FileInfoBadge from "src/ui/components/FileInfo";
import "./index.css";

interface LoadingScreenProps {
	fileName: string;
	fileSize?: number;
	fromFormat?: string;
	toFormat?: string;
	fromExtension?: string;
	toExtension?: string;
	statusText?: string;
}

export default function LoadingScreen({
	fileName,
	fileSize,
	fromFormat,
	toFormat,
	fromExtension,
	toExtension,
	statusText = "Finding conversion route..."
}: LoadingScreenProps) {
	return (
		<div className="loading-screen">
			<div className="loading-spinner-wrap">
				<Loader2 size={40} className="loading-spinner" />
			</div>

			<h2 className="loading-title">{statusText}</h2>

			<div className="loading-conversion-info">
				{fromFormat && (
					<span className="loading-format-badge">{fromExtension?.toUpperCase() || fromFormat}</span>
				)}
				{fromFormat && toFormat && (
					<ArrowRight size={18} className="loading-arrow" />
				)}
				{toFormat && (
					<span className="loading-format-badge">{toExtension?.toUpperCase() || toFormat}</span>
				)}
			</div>

			<div className="loading-file-info">
				<FileInfoBadge
					fileName={fileName}
					fileSize={fileSize}
					extension={fromExtension}
				/>
			</div>
		</div>
	);
}
