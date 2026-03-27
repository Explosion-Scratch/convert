import { render } from "preact";
import { signal } from "@preact/signals";

import UploadPage from "./pages/Upload";
import ConversionPage from "./pages/Conversion";
import { initTheme } from "./ThemeStore";
import { type PopupDataContainer } from "./PopupStore";
import Popup from "./components/Popup";
import { initMode } from "./ModeStore";

console.log("Rendering UI");

export const enum Pages {
	Upload = "uploadPage",
	Conversion = "conversionPage"
}

export const CurrentPage = signal<Pages>(Pages.Upload);
export const PopupData = signal<PopupDataContainer>({
	title: "Loading tools...",
	text: "Please wait while the app loads conversion tools.",
	dismissible: false,
	buttonText: "Ignore"
});

export const LoadingToolsText = signal<string | undefined>("Loading conversion tools...");

function App() {
	return (
		<>
			{CurrentPage.value === Pages.Conversion && <ConversionPage />}
			{CurrentPage.value === Pages.Upload && <UploadPage />}
			<Popup />
		</>
	);
}

render(<App />, document.body);

initTheme();
initMode();
