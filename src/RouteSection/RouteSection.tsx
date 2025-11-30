import { FunctionComponent, useRef, useEffect } from "react";
import NavMenu from "../NavMenu/NavMenu";
// @ts-ignore
import OpenSeadragon from "openseadragon";
import Logo from "../Utils/Logo/Logo";
import "./RouteSection.css";

const RouteSection: FunctionComponent<{}> = () => {
    const viewerRef = useRef<HTMLDivElement | null>(null);

    const closeMenu = () => {
        const elem = document.getElementById("2f05ecdc-9813-4135-965b-8cf5402c2cd7");
        if (elem) elem.click();
    };

    useEffect(() => {
        if (!viewerRef.current) return;

        const viewer = OpenSeadragon({
            element: viewerRef.current,
            prefixUrl: "/openseadragon/images/",
            tileSources: {
                type: "image",
                url: process.env.REACT_APP_ROUTE_IMAGE_URL!,
                crossOriginPolicy: "Anonymous",
            },
            showNavigationControl: true,
            drawer: 'canvas',
            maxZoomPixelRatio: 2,
            minZoomImageRatio: 0.8,
            navigationControlAnchor: OpenSeadragon.ControlAnchor.BOTTOM_RIGHT,
        });

        viewer.addHandler("canvas-press", closeMenu);
        viewer.addHandler("canvas-click", closeMenu);

        return () => {
            viewer.removeHandler("canvas-press", closeMenu);
            viewer.removeHandler("canvas-click", closeMenu);
            viewer.destroy();
        };
    }, []);

    return (
        <div className="RouteSection">
            <div className="RouteSectionLogo">
                <Logo />
            </div>
            <div className="RouteSectionControls">
                <NavMenu />
            </div>

            <div
                ref={viewerRef}
                className="RouteViewer"
                style={{
                    width: "100vw",
                    height: "100vh",
                    background: "#242526"
                }}
            />
        </div>
    );
};

export default RouteSection;
