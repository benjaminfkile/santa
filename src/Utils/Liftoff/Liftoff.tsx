import { FunctionComponent } from "react";
import formatElapsed from "../../Utils/formatElapsed";
import "./Liftoff.css";

interface LiftoffProps {
  liftoff: number | null | undefined;
  theme: string;
}

const Liftoff: FunctionComponent<LiftoffProps> = ({ liftoff, theme }) => {
  const themeId = `liftoff-${theme.toLowerCase()}`;

  return (
    <div className="LiftoffWrapper slide-in-left" id={themeId}>
      <div id="liftoff-content-wrapper">
        <span className="material-icons" id="liftoff-icon">
          flight_takeoff
        </span>
        <p>Airborne {formatElapsed(liftoff)}</p>
      </div>
    </div>
  );
};

export default Liftoff;
