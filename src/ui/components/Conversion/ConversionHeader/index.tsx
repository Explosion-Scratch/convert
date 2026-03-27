import Logo from "src/ui/components/Logo";
import AdvancedModeToggle from "src/ui/components/AdvancedModeToggle";
import FileInfoBadge from "src/ui/components/FileInfo";
import { SelectedFiles } from "src/main.new";
import { CurrentPage, Pages } from "src/ui";

import "./index.css";

interface ConversionHeaderProps {
	stepLabel?: string;
}

export default function ConversionHeader({ stepLabel }: ConversionHeaderProps) {
	const files = Object.values(SelectedFiles.value);
	const firstFile = files[0];

	const removeFile = (file: File) => {
		const key = `${file.name}-${file.lastModified}` as const;
		const { [key]: _, ...rest } = SelectedFiles.value;
		SelectedFiles.value = rest;
		if (Object.keys(rest).length === 0) CurrentPage.value = Pages.Upload;
	};

	return (
		<header className="conversion-header">
			<div className="header-left">
				<Logo showName={true} size={24} />
				{stepLabel && <span className="header-step-label">{stepLabel}</span>}
			</div>

			<div className="header-center">
				{files.map(file => (
					<FileInfoBadge
						key={`${file.name}-${file.lastModified}`}
						fileName={file.name}
						fileSize={file.size}
						extension={file.name.split(".").pop()}
						mimeType={file.type}
						onRemove={() => removeFile(file)}
					/>
				))}
			</div>

			<div className="header-right">
				<AdvancedModeToggle compact={true} />
			</div>
		</header>
	);
}
