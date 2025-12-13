import { FunctionComponent, useEffect, useState } from "react";
import formatElapsed from "../../Utils/formatElapsed";
import "./Liftoff.css";

interface LiftoffProps {
  liftoff: string;
  theme: string;
}

const Liftoff: FunctionComponent<LiftoffProps> = ({ liftoff, theme }) => {
  const themeId = `liftoff-${theme.toLowerCase()}`;
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="LiftoffWrapper slide-in-left" id={themeId}>
      <div id="liftoff-content-wrapper">
        <span className="material-icons" id="liftoff-icon">
          flight_takeoff
        </span>
        <p>Airborne {formatElapsed(liftoff, now)}</p>
      </div>
    </div>
  );
};

export default Liftoff;
