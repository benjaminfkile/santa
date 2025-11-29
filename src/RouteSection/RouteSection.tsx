import { FunctionComponent } from "react";
import NavMenu from "../NavMenu/NavMenu";
import JumpingElf from "../Utils/JumpingElf/JumpingElf";
import RouteZoomer from "../Utils/RouteZoomer";
import "./RouteSection.css";

const RouteSection: FunctionComponent<{}> = () => {
    return (
        <div className="RouteSection">
            
            {/* TOP LAYER */}
            <div className="RouteSectionControls">
                <NavMenu />
                <JumpingElf />
            </div>

            {/* BOTTOM LAYER */}
            <div className="RouteSectionZoomer">
                <RouteZoomer src={process.env.REACT_APP_ROUTE_IMAGE_URL!} />
            </div>

        </div>
    );
}

export default RouteSection;
