import { useRef, useState } from "preact/hooks";
import { CurrentPage, LoadingToolsText, Pages } from "src/ui/AppState";
import { goToUploadHome, SelectedFiles } from "src/main.new";
import { Upload } from "lucide-preact";

import Logo from "src/ui/components/Logo";
import HelpButton from "src/ui/components/HelpButton";
import Footer from "src/ui/components/Footer";

import "./index.css";

export default function UploadPage() {
	const [isDragging, setIsDragging] = useState(false);
	const dragCounter = useRef<number>(0);
	const fileRef = useRef<HTMLInputElement>(null);

	const handleClick = (ev: MouseEvent) => {
		ev.preventDefault();
		if (!formatsReady) return;
		fileRef.current?.click();
	};

	const formatsReady = LoadingToolsText.value === undefined;

	const processFiles = (fileList: FileList | null | undefined) => {
		if (!fileList || fileList.length === 0) return;
		if (!formatsReady) return;

		for (const file of fileList) {
			SelectedFiles.value = {
				...SelectedFiles.value,
				[`${file.name}-${file.lastModified}`]: file
			};
		}
		CurrentPage.value = Pages.Conversion;
	};

	const handleDrop = (ev: DragEvent) => {
		ev.preventDefault();
		setIsDragging(false);
		dragCounter.current = 0;
		if (!formatsReady) return;
		processFiles(ev.dataTransfer?.files);
	};

	const handleDragEnter = (ev: DragEvent) => {
		ev.preventDefault();
		if (!formatsReady) return;
		dragCounter.current++;
		if (ev.dataTransfer?.types.includes("Files")) setIsDragging(true);
	};

	const handleDragLeave = (ev: DragEvent) => {
		ev.preventDefault();
		dragCounter.current--;
		if (dragCounter.current === 0) setIsDragging(false);
	};

	const handleDragOver = (ev: DragEvent) => {
		ev.preventDefault();
	};

	const handleChange = () => {
		processFiles(fileRef.current?.files);
	};

	const handleLogoClick = () => {
		goToUploadHome();
		if (fileRef.current) fileRef.current.value = "";
	};

	return (
		<div className="upload-page">
			<div className="upload-card">
				<div className="upload-card-header">
					<Logo showName={true} size={36} onClick={handleLogoClick} />
				</div>

				<div
					className={`upload-dropzone ${isDragging ? "active-drag" : ""} ${!formatsReady ? "upload-dropzone--pending" : ""}`}
					onClick={handleClick}
					onDrop={handleDrop}
					onDragOver={handleDragOver}
					onDragEnter={handleDragEnter}
					onDragLeave={handleDragLeave}
					role="button"
					tabIndex={0}
					onKeyDown={(e) => {
						if (e.key === "Enter" || e.key === " ") {
							e.preventDefault();
							if (!formatsReady) return;
							fileRef.current?.click();
						}
					}}
				>
					<input
						ref={fileRef}
						type="file"
						name="uploadFile"
						id="uploadFile"
						onClick={(ev) => ev.stopPropagation()}
						tabIndex={0}
						multiple
						disabled={!formatsReady}
						onChange={handleChange}
					/>
					<div className="upload-icon-wrap">
						<Upload size={32} />
					</div>
					<span className="upload-cta">Click to upload file</span>
					<span className="upload-hint">or drag and drop here</span>
				</div>

				<div className="upload-card-actions">
					<HelpButton />
				</div>
			</div>

			<Footer loadingText={LoadingToolsText.value} />
		</div>
	);
}
