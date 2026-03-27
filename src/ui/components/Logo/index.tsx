import { RefreshCcw } from "lucide-preact";
import "./index.css";

interface LogoProps {
	showName?: boolean;
	size?: number;
}

export default function Logo({ showName = false, size = 28 }: LogoProps) {
	return (
		<div className="logo">
			<div className="logo-icon">
				<RefreshCcw size={size} strokeWidth={2.5} />
			</div>
			{showName && <span className="logo-name">Convert to it!</span>}
		</div>
	);
}
