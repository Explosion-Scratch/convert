import { RotateCcw, X } from "lucide-preact";
import { useEffect, useState } from "preact/hooks";
import type { FormatHandler, HandlerOptionDefinition } from "src/FormatHandler";

import "./index.css";

interface HandlerOptionsModalProps {
	open: boolean;
	scope: "input" | "output";
	handler: FormatHandler | null;
	visibleOptions: HandlerOptionDefinition[];
	availableHandlers: FormatHandler[];
	showHandlerPicker: boolean;
	onSelectHandler: (handlerName: string) => void;
	onApplyOption: (handler: FormatHandler, option: HandlerOptionDefinition, value: unknown) => void;
	onResetHandler: (handler: FormatHandler) => void;
	onClose: () => void;
}

export default function HandlerOptionsModal({
	open,
	scope,
	handler,
	visibleOptions,
	availableHandlers,
	showHandlerPicker,
	onSelectHandler,
	onApplyOption,
	onResetHandler,
	onClose,
}: HandlerOptionsModalProps) {
	const [numberInputValues, setNumberInputValues] = useState<Record<string, string>>({});

	useEffect(() => {
		const handleEscape = (ev: KeyboardEvent) => {
			if (ev.key === "Escape" && open) {
				onClose();
			}
		};
		document.addEventListener("keydown", handleEscape);
		return () => document.removeEventListener("keydown", handleEscape);
	}, [open, onClose]);

	if (!open) return null;

	const title = handler ? `${handler.name} Settings` : (scope === "input" ? "Input Settings" : "Output Settings");

	const handleReset = () => {
		if (!handler) return;
		const confirmed = confirm(`Are you sure you want to reset all settings for ${handler.name}?`);
		if (confirmed) {
			onResetHandler(handler);
		}
	};

	const isOptionChanged = (option: HandlerOptionDefinition): boolean => {
		if (option.defaultValue === undefined) return false;
		const currentValue = option.getValue();
		const defaultValue = option.defaultValue;
		
		if (Array.isArray(currentValue) && Array.isArray(defaultValue)) {
			if (currentValue.length !== defaultValue.length) return true;
			return currentValue.some((v, i) => v !== defaultValue[i]);
		}
		
		return currentValue !== defaultValue;
	};

	const renderOptionControl = (option: HandlerOptionDefinition) => {
		if (!handler) return null;

		switch (option.kind) {
			case "toggle":
				return (
					<label className="handler-option-toggle">
						<input
							type="checkbox"
							checked={option.getValue()}
							onInput={(ev) => onApplyOption(handler, option, ev.currentTarget.checked)}
						/>
						<span>{option.getValue() ? "On" : "Off"}</span>
					</label>
				);
			case "number": {
				const value = option.getValue();
				const inputValue = numberInputValues[option.id] ?? String(value);
				
				return (
					<div className="handler-option-number">
						{option.control === "slider" && (
							<input
								type="range"
								min={option.min}
								max={option.max}
								step={option.step ?? 1}
								value={value}
								onInput={(ev) => onApplyOption(handler, option, Number(ev.currentTarget.value))}
							/>
						)}
						<label className="handler-option-inline-field">
							<input
								type="number"
								step={option.step ?? 1}
								value={inputValue}
								onInput={(ev) => {
									setNumberInputValues(prev => ({ ...prev, [option.id]: ev.currentTarget.value }));
								}}
								onBlur={(ev) => {
									const parsed = Number(ev.currentTarget.value);
									let finalValue: number;
									
									if (!Number.isFinite(parsed) || ev.currentTarget.value === "") {
										finalValue = option.defaultValue ?? value;
									} else {
										finalValue = parsed;
										if (typeof option.min === "number") finalValue = Math.max(option.min, finalValue);
										if (typeof option.max === "number") finalValue = Math.min(option.max, finalValue);
									}
									
									onApplyOption(handler, option, finalValue);
									setNumberInputValues(prev => {
										const next = { ...prev };
										delete next[option.id];
										return next;
									});
								}}
							/>
							{option.unit && <span>{option.unit}</span>}
						</label>
					</div>
				);
			}
			case "text":
				if (option.multiline) {
					return (
						<textarea
							className="handler-option-textarea"
							placeholder={option.placeholder}
							minLength={option.minLength}
							maxLength={option.maxLength}
							value={option.getValue()}
							onInput={(ev) => onApplyOption(handler, option, ev.currentTarget.value)}
						/>
					);
				}
				return (
					<input
						type={option.inputType ?? "text"}
						placeholder={option.placeholder}
						minLength={option.minLength}
						maxLength={option.maxLength}
						value={option.getValue()}
						onInput={(ev) => onApplyOption(handler, option, ev.currentTarget.value)}
					/>
				);
			case "select":
				return (
					<select
						value={option.getValue()}
						onInput={(ev) => onApplyOption(handler, option, ev.currentTarget.value)}
					>
						{option.choices.map(choice => (
							<option key={choice.value} value={choice.value} title={choice.description}>
								{choice.label}
							</option>
						))}
					</select>
				);
			case "multiselect": {
				const selected = new Set(option.getValue());
				return (
					<div className="handler-option-multi-list">
						{option.choices.map(choice => {
							const checked = selected.has(choice.value);
							return (
								<label className="handler-option-multi-item" key={choice.value} title={choice.description}>
									<input
										type="checkbox"
										checked={checked}
										onInput={(ev) => {
											const current = option.getValue();
											const next = ev.currentTarget.checked
												? Array.from(new Set([...current, choice.value]))
												: current.filter(value => value !== choice.value);
											onApplyOption(handler, option, next);
										}}
									/>
									<span>{choice.label}</span>
								</label>
							);
						})}
					</div>
				);
			}
		}
	};

	return (
		<div
			className="handler-options-modal-overlay"
			onClick={(ev) => {
				if (ev.target === ev.currentTarget) onClose();
			}}
		>
			<section className="handler-options-modal">
				<header className="handler-options-modal-header">
					<div className="handler-options-modal-title-wrap">
						<h3>{title}</h3>
					</div>
					<div className="handler-options-modal-actions">
						{handler && (
							<button className="handler-modal-icon-btn" title="Reset plugin settings" onClick={handleReset}>
								<RotateCcw size={16} />
							</button>
						)}
						<button className="handler-modal-icon-btn" title="Close settings" onClick={onClose}>
							<X size={16} />
						</button>
					</div>
				</header>

				{showHandlerPicker && availableHandlers.length > 1 && (
					<div className="handler-options-plugin-picker">
						<span>Plugin</span>
						<select
							value={handler?.name ?? ""}
							onInput={(ev) => onSelectHandler(ev.currentTarget.value)}
						>
							{availableHandlers.map(candidate => (
								<option key={candidate.name} value={candidate.name}>{candidate.name}</option>
							))}
						</select>
					</div>
				)}

				{!handler && <p className="conversion-settings-empty">Pick a format first to open plugin settings.</p>}
				{handler && visibleOptions.length === 0 && (
					<p className="conversion-settings-empty">This plugin has no visible settings right now.</p>
				)}
				{handler && visibleOptions.length > 0 && (
					<div className="conversion-option-list">
						{visibleOptions.map(option => (
							<div 
								className="conversion-option-item" 
								key={option.id}
								data-changed={isOptionChanged(option) ? "true" : undefined}
							>
								<div className="conversion-option-header">
									<span className="conversion-option-name">{option.name}</span>
									{option.description && <span className="conversion-option-description">{option.description}</span>}
								</div>
								{renderOptionControl(option)}
							</div>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
