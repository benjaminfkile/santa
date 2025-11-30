import { useEffect, useState, useRef, useCallback } from "react";
import { Route, Switch } from "react-router-dom";
import axios from "axios";
import SantaTracker from "./SantaTracker/SantaTracker";
import AboutSection from "./AboutSection/AboutSection";
import DonateSection from "./DonateSection/DonateSection";
import FundStatus from "./FundStatus/FundStatus";
import SponsorsSection from "./SponsorsSection/SponsorsSection";
import ContactSection from "./ContactSection/ContactSection";
import fundData from "./Utils/FundsRing/FundData";
import RouteSection from "./RouteSection/RouteSection";
import "bootstrap/dist/css/bootstrap.min.css";
import { ISantaFlyoverData, ISponsor, ISantaRoute } from "./interfaces";


export default function App() {
  const API = process.env.REACT_APP_API_URL!;

  // -------------------------------
  // STATE
  // -------------------------------
  const [santaFlyoverData, setSantaFlyoverData] = useState<ISantaFlyoverData | null>(null);
  const [sponsors, setSponsors] = useState<ISponsor[]>([]);
  const [route, setRoute] = useState<ISantaRoute[]>([]);

  const updateFrequency = useRef<number>(5000);
  const santaTimer = useRef<NodeJS.Timeout | null>(null);

  // -------------------------------
  // SMALL API WRAPPER
  // -------------------------------
  const apiGet = useCallback(
    async <T,>(path: string): Promise<T> => {
      const res = await axios.get<T>(`${API}/${path}`);
      return res.data;
    },
    [API]
  );

  // -------------------------------
  // FETCH SANTA LOCATION
  // -------------------------------
  const getSanta = useCallback(async () => {
    clearTimeout(santaTimer.current as any);

    try {
      const data = await apiGet<ISantaFlyoverData>("api/location");

      // Do NOT add weird fallbacks — API already normalizes shape
      if (typeof data.interval === "number" && data.interval > 0) {
        updateFrequency.current = data.interval;
      } else {
        updateFrequency.current = 5000;
      }

      setSantaFlyoverData(data);
    } catch (err) {
      console.error("Santa fetch failed:", err);
    } finally {
      santaTimer.current = setTimeout(getSanta, updateFrequency.current);
    }
  }, [apiGet]);

  // -------------------------------
  // FETCH SPONSORS
  // -------------------------------
  const getSponsors = useCallback(async () => {
    try {
      const data = await apiGet<ISponsor[]>("api/sponsors");
      setSponsors(data);
    } catch (err) {
      console.error("Sponsors fetch failed:", err);
    }
  }, [apiGet]);

  // -------------------------------
  // FETCH ROUTE
  // -------------------------------
  const getRoute = useCallback(async () => {
    try {
      const data = await apiGet<ISantaRoute[]>("api/flight-history");
      setRoute(data);
    } catch (err) {
      console.error("Route fetch failed:", err);
    }
  }, [apiGet]);

  // -------------------------------
  // ON MOUNT
  // -------------------------------
  useEffect(() => {
    (async () => {
      await Promise.all([getSanta(), getSponsors(), getRoute()]);
      fundData.getFundData();

      console.log(
        "\n  .-\"\"-.\r\n \\/,..___\\\r\n() {_____}\r\n  (\\/-@-@-\\)\r\n  {`-=^=-'}\r\n  {  `-'  }\r\n   {     }\r\n    `---'\n\nDeveloped by Ben Kile\n\n"
      );
    })();

    return () => {
      if (santaTimer.current) clearTimeout(santaTimer.current);
    };
  }, [getSanta, getSponsors, getRoute]);

  // -------------------------------
  // MODE
  // -------------------------------
  const mode = Number(santaFlyoverData?.mode ?? 0);

  return (
    <div className="WimsfoSanta">
      {mode !== 1 && (
        <Switch>
          <Route exact path="/" component={AboutSection} />
          <Route path="/about" component={AboutSection} />
          <Route path="/donate" component={DonateSection} />
          <Route path="/funding" component={FundStatus} />
          <Route
            path="/santa"
            render={() => (
              <SantaTracker santaFlyoverData={santaFlyoverData} sponsors={sponsors} route={route} />
            )}
          />
          <Route
            path="/sponsors"
            render={() => <SponsorsSection sponsors={sponsors} />}
          />
          <Route path="/contact" component={ContactSection} />
          <Route path="/route" component={RouteSection} />
        </Switch>
      )}

      {mode === 1 && (
        <SantaTracker santaFlyoverData={santaFlyoverData} sponsors={sponsors} route={route} />
      )}

      <div id="snackbar">snacks</div>
    </div>
  );
}
