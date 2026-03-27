import { ExternalLink } from "lucide-preact";
import "./index.css";

interface FooterProps {
	loadingText?: string;
}

export default function Footer({ loadingText }: FooterProps) {
	return (
		<footer>
			<div className="footer-item footer-copyright">
				<span className="footer-link-text">&copy; 2026, p2r3</span>
			</div>
			{loadingText && (
				<div className="footer-item footer-loading">
					<span className="footer-link-text">{loadingText}</span>
				</div>
			)}
			<a href="https://github.com/p2r3/convert" target="_blank" className="footer-item" rel="noopener">
				<ExternalLink size={12} />
				<span className="footer-link-text">Source</span>
			</a>
		</footer>
	);
}
