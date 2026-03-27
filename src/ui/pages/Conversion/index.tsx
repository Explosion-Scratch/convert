import './index.css';

import { useState, useMemo, useCallback } from "preact/hooks";
import { ConversionOptions, SelectedFiles, type ConversionOption, type ConversionOptionsMap } from 'src/main.new';
import { Mode, ModeEnum } from "src/ui/ModeStore";
import normalizeMimeType from "src/normalizeMimeType";

import ConversionHeader from "src/ui/components/Conversion/ConversionHeader";
import FormatExplorer from "src/ui/components/Conversion/FormatExplorer";
import LoadingScreen from "src/ui/components/LoadingScreen";
import Footer from "src/ui/components/Footer";
import { ArrowLeft, ArrowRight } from "lucide-preact";
import { PopupData } from "src/ui";
import { closePopup, openPopup } from "src/ui/PopupStore";

type ConversionStep = "select-from" | "select-to" | "converting";

function getConversionOptions(): ConversionOptionsMap {
	if (ConversionOptions.size) return ConversionOptions;
	throw new Error("Can't build format list!", { cause: "UI got empty global format list" });
}

function getMatchingFromFormats(options: ConversionOptionsMap, files: File[]): ConversionOptionsMap {
	if (files.length === 0) return options;

	const file = files[0];
	const mimeType = normalizeMimeType(file.type);
	const ext = file.name.split(".").pop()?.toLowerCase() || "";
	const matched: ConversionOptionsMap = new Map();

	for (const [format, handler] of options) {
		if (!format.from) continue;
		if (format.mime === mimeType || format.extension.toLowerCase() === ext) {
			matched.set(format, handler);
		}
	}

	return matched.size > 0 ? matched : options;
}

function downloadFile(bytes: Uint8Array, name: string, mime: string) {
	const blob = new Blob([bytes as BlobPart], { type: mime });
	const link = document.createElement("a");
	link.href = URL.createObjectURL(blob);
	link.download = name;
	link.click();
}

export default function Conversion() {
	const allOptions = getConversionOptions();
	const files = Object.values(SelectedFiles.value);
	const firstFile = files[0];

	const matchingFrom = useMemo(
		() => getMatchingFromFormats(allOptions, files),
		[allOptions, files]
	);

	const autoAdvance = useMemo(() => {
		if (!matchingFrom.size) return false;
		const isSimple = Mode.value === ModeEnum.Simple;
		if (!isSimple) return matchingFrom.size === 1;
		const uniqueFormats = new Set<string>();
		for (const [format] of matchingFrom) {
			uniqueFormats.add(`${format.mime}|${format.format}`);
		}
		return uniqueFormats.size === 1;
	}, [matchingFrom, Mode.value]);

	const [step, setStep] = useState<ConversionStep>(() => {
		if (autoAdvance) return "select-to";
		return "select-from";
	});

	const [fromOption, setFromOption] = useState<ConversionOption | null>(() => {
		if (autoAdvance) {
			const first = matchingFrom.entries().next().value;
			return first ? [first[0], first[1]] : null;
		}
		return null;
	});

	const [toOption, setToOption] = useState<ConversionOption | null>(null);
	const [isConverting, setIsConverting] = useState(false);

	const handleFromSelect = useCallback((option: ConversionOption) => {
		setFromOption(option);
	}, []);

	const handleToSelect = useCallback((option: ConversionOption) => {
		setToOption(option);
	}, []);

	const handleNext = () => {
		if (step === "select-from" && fromOption) {
			setStep("select-to");
			setToOption(null);
		}
	};

	const handleBack = () => {
		if (step === "select-to") {
			setStep("select-from");
			setToOption(null);
		}
	};

	const handleConvert = async () => {
		if (!fromOption || !toOption || !firstFile) return;

		setIsConverting(true);
		setStep("converting");

		try {
			const inputFileData = [];
			for (const f of files) {
				const buf = await f.arrayBuffer();
				const bytes = new Uint8Array(buf);

				if (fromOption[0].mime === toOption[0].mime && fromOption[0].format === toOption[0].format) {
					downloadFile(bytes, f.name, toOption[0].mime);
					continue;
				}
				inputFileData.push({ name: f.name, bytes });
			}

			if (inputFileData.length === 0) {
				setIsConverting(false);
				setStep("select-to");
				return;
			}

			const fromNode = { handler: fromOption[1], format: fromOption[0] };
			const toNode = { handler: toOption[1], format: toOption[0] };

			const output = await window.tryConvertByTraversing(inputFileData, fromNode, toNode);

			if (!output) {
				setIsConverting(false);
				setStep("select-to");
				PopupData.value = {
					title: "Conversion failed",
					text: "Could not find a valid conversion route between these formats.",
					dismissible: true,
					buttonText: "OK",
				};
				openPopup();
				return;
			}

			for (const file of output.files) {
				downloadFile(file.bytes, file.name, toOption[0].mime);
			}

			PopupData.value = {
				title: "Conversion complete!",
				text: `Converted ${fromOption[0].format.toUpperCase()} → ${toOption[0].format.toUpperCase()} via ${output.path.map(c => c.format.format).join(" → ")}`,
				dismissible: true,
				buttonText: "OK",
			};
			openPopup();
		} catch (e) {
			console.error(e);
			PopupData.value = {
				title: "Conversion error",
				text: `An unexpected error occurred: ${e}`,
				dismissible: true,
				buttonText: "OK",
			};
			openPopup();
		} finally {
			setIsConverting(false);
			setStep("select-to");
		}
	};

	const stepLabel = step === "select-from"
		? "Step 1 · Select input format"
		: step === "select-to"
			? "Step 2 · Select output format"
			: "Converting...";

	const canProceed = step === "select-from" ? !!fromOption : !!toOption;

	return (
		<div className="conversion-body">
			<ConversionHeader stepLabel={stepLabel} />

			<main className="conversion-main">
				{step === "converting" ? (
					<LoadingScreen
						fileName={firstFile?.name || "file"}
						fileSize={firstFile?.size}
						fromFormat={fromOption?.[0].name}
						toFormat={toOption?.[0].name}
						fromExtension={fromOption?.[0].extension}
						toExtension={toOption?.[0].extension}
					/>
				) : (
					<FormatExplorer
						conversionOptions={step === "select-from" ? matchingFrom : allOptions}
						onSelect={step === "select-from" ? handleFromSelect : handleToSelect}
						filterDirection={step === "select-from" ? "from" : "to"}
					/>
				)}
			</main>

			{step !== "converting" && (
				<div className="conversion-action-bar">
					{step === "select-to" && (
						<button className="action-btn action-btn-back" onClick={handleBack}>
							<ArrowLeft size={16} />
							Back
						</button>
					)}
					<button
						className={`action-btn action-btn-primary ${!canProceed ? "disabled" : ""}`}
						disabled={!canProceed}
						onClick={step === "select-from" ? handleNext : handleConvert}
					>
						{step === "select-from" ? "Next" : "Convert"}
						{step === "select-from" && <ArrowRight size={16} />}
					</button>
				</div>
			)}

			<Footer />
		</div>
	);
}
