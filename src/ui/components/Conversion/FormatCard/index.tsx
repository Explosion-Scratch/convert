import type { ConversionOption } from "src/main.new";
import FileIcon from "src/ui/components/FileIcon";
import "./index.css";

interface FormatCardProps {
	conversionOption: ConversionOption;
	id: string;
	selected: boolean;
	onSelect: (id: string) => void;
	advanced?: boolean;
}

export default function FormatCard({ conversionOption, id, selected, onSelect, advanced = false }: FormatCardProps) {
	const [format, handler] = conversionOption;

	const cleanName = advanced
		? format.name
		: format.name
			.split("(").join(")").split(")")
			.filter((_, i) => i % 2 === 0)
			.filter(c => c !== "")
			.join(" ")
			.trim();

	return (
		<button
			className={`format-card ${selected ? "active" : ""}`}
			onClick={() => onSelect(id)}
		>
			<div className="format-card-row">
				<FileIcon extension={format.extension} mimeType={format.mime} size={22} />
				<div className="format-card-text">
					<span className="format-card-ext">.{format.extension.toUpperCase()}</span>
					<span className="format-card-name">{cleanName}</span>
				</div>
			</div>
			{advanced && (
				<div className="format-card-meta">
					<span className="format-card-mime">{format.mime}</span>
					<span className="format-card-plugin">{handler.name}</span>
				</div>
			)}
		</button>
	);
}
