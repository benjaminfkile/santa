import { useEffect, useState, useRef, useCallback } from "react";
import { Route, Switch } from "react-router-dom";
import axios from "axios";

import SantaTracker from "./SantaTracker/SantaTracker";
import AboutSection from "./AboutSection/AboutSection";
import DonateSection from "./DonateSection/DonateSection";
import FundStatus from "./FundStatus/FundStatus";
import SponsorsSection from "./SponsorsSection/SponsorsSection";
import ContactSection from "./ContactSection/ContactSection";
import RouteSection from "./RouteSection/RouteSection";

import fundData from "./Utils/FundsRing/FundData";
import { ISantaFlyoverData, ISponsor, ISantaRoute } from "./interfaces";

import "bootstrap/dist/css/bootstrap.min.css";
import snackBar from "./Utils/snackBar/SnackBar";

export default function App() {
  const API = process.env.REACT_APP_API_URL!;

  const [santaFlyoverData, setSantaFlyoverData] =
    useState<ISantaFlyoverData | null>(null);
  const [sponsors, setSponsors] = useState<ISponsor[]>([]);
  const [route, setRoute] = useState<ISantaRoute[]>([]);

  // -----------------------------------
  // SHARED API WRAPPER
  // -----------------------------------
  const apiGet = useCallback(
    async <T,>(path: string): Promise<T> => {
      const res = await axios.get<T>(`${API}/${path}`);
      return res.data;
    },
    [API]
  );

  // -----------------------------------
  // SANTA LOCATION
  // -----------------------------------
  const updateFrequency = useRef<number>(5000);
  const santaTimer = useRef<NodeJS.Timeout | null>(null);

  const getSanta = useCallback(async () => {
    if (santaTimer.current) clearTimeout(santaTimer.current);

    try {
      const data = await apiGet<ISantaFlyoverData>("api/location");

      if (typeof data.interval === "number" && data.interval > 0) {
        updateFrequency.current = data.interval;
      } else {
        updateFrequency.current = 5000;
      }

      setSantaFlyoverData(data);
    } catch (err) {
      console.error("Santa fetch failed:", err);
      snackBar({ text: "Failed to fetch location data", type: "error", timeout: 3000 })
    } finally {
      santaTimer.current = setTimeout(getSanta, updateFrequency.current);
    }
  }, [apiGet]);

  // -----------------------------------
  // SPONSORS RETRY LOOP
  // -----------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadSponsors = async () => {
      try {
        const data = await apiGet<ISponsor[]>("api/sponsors");
        if (cancelled) return;
        setSponsors(data);
        console.log("[sponsors] loaded");
      } catch (err) {
        console.warn("[sponsors] failed, retrying in 5s");
        snackBar({ text: "Failed to fetch sponsors", type: "error", timeout: 3000 })
        if (!cancelled) setTimeout(loadSponsors, 5000);
      }
    };

    loadSponsors();
    return () => {
      cancelled = true;
    };
  }, [apiGet]);

  // -----------------------------------
  // ROUTE RETRY LOOP
  // -----------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadRoute = async () => {
      try {
        const data = await apiGet<ISantaRoute[]>("api/flight-history");
        if (cancelled) return;
        setRoute(data);
        console.log("[route] loaded");
      } catch (err) {
        console.warn("[route] failed, retrying in 5s");
        snackBar({ text: "Failed to fetch route", type: "error", timeout: 3000 })
        if (!cancelled) setTimeout(loadRoute, 5000);
      }
    };

    loadRoute();
    return () => {
      cancelled = true;
    };
  }, [apiGet]);

  // -----------------------------------
  // FUNDS RETRY LOOP
  // -----------------------------------
  useEffect(() => {
    let cancelled = false;

    const loadFunds = async () => {
      try {
        await fundData.getFundData();
        if (cancelled) return;
        console.log("[funds] loaded");
      } catch (err) {
        console.warn("[funds] failed, retrying in 5s");
        if (!cancelled) setTimeout(loadFunds, 5000);
      }
    };

    loadFunds();
    return () => {
      cancelled = true;
    };
  }, []);

  // -----------------------------------
  // START SANTA LOOP ON MOUNT
  // -----------------------------------
  useEffect(() => {
    getSanta();

    console.log(
      "\n  .-\"\"-.\r\n \\/,..___\\\r\n() {_____}\r\n  (\\/-@-@-\\)\r\n  {`-=^=-'}\r\n  {  `-'  }\r\n   {     }\r\n    `---'\n\nDeveloped by Ben Kile\n\n"
    );

    return () => {
      if (santaTimer.current) clearTimeout(santaTimer.current);
    };
  }, [getSanta]);

  // -----------------------------------
  // MODE
  // -----------------------------------
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
              <SantaTracker
                santaFlyoverData={santaFlyoverData}
                sponsors={sponsors}
                route={route}
              />
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
        <SantaTracker
          santaFlyoverData={santaFlyoverData}
          sponsors={sponsors}
          route={route}
        />
      )}

      <div id="snackbar">snacks</div>
    </div>
  );
}