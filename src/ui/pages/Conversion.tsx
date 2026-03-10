import faImageRegular from '../img/fa-image-regular-full.svg';
import faBoxArchiveSolid from '../img/fa-box-archive-solid-full.svg';
import faFileLinesRegular from '../img/fa-file-lines-regular-full.svg';
import faVideoSolid from '../img/fa-video-solid-full.svg';
import faMusicSolid from '../img/fa-music-solid-full.svg';

import './Conversion.css'

import { type FormatCategory } from "../components/Conversion/SideNav";
import Footer from "../components/Footer";
import ConversionSidebar from "../components/Conversion/ConversionSidebar";
import SelectedFileInfo from "../components/Conversion/SelectedFileInfo";
import ConversionHeader from "../components/Conversion/ConversionHeader";
import { ConversionOptions, type ConversionOptionsMap } from 'src/main.new';

import FormatExplorer from "../components/Conversion/FormatExplorer.tsx";
import { useState } from "preact/hooks";

interface ConversionPageProps {

}

const sidebarItems: FormatCategory[] = [ // Placeholder categories
    { id: "arc", category: "Archive", icon: faBoxArchiveSolid },
    { id: "img", category: "Image", icon: faImageRegular },
    { id: "doc", category: "Document", icon: faFileLinesRegular },
    { id: "vid", category: "Video", icon: faVideoSolid },
    { id: "aud", category: "Audio", icon: faMusicSolid },
    { id: "ebk", category: "E-Book", icon: faFileLinesRegular },
];

/**
 * Flimsy getter to check to see if the conversion backend
 * borked and didn't return any conversion options
 */
function getConversionOptions() {
    if (ConversionOptions.size) {
        return ConversionOptions
    } else throw new Error("Can't build format list! Failed to get global format list");
}

export default function Conversion({ }: ConversionPageProps) {
    const AvailableConversionOptions: ConversionOptionsMap = getConversionOptions();
    const [selectedOption, setSelectedOption] = useState<ConversionOptionsMap | null>(null);

    return (
        <div className="conversion-body">
            <ConversionHeader />

            {/* Mobile File Info */ }
            <SelectedFileInfo className="mobile-only" />

            <main className="conversion-main">
                <FormatExplorer categories={ sidebarItems } conversionFormats={ AvailableConversionOptions } onSelect={ setSelectedOption } />

                {/* Right Settings Sidebar / Bottom Settings Accordion */ }
                <ConversionSidebar conversionData={ selectedOption } />
            </main>
            <Footer visible={ false } />
        </div>
    );
}
