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
import "bootstrap/dist/css/bootstrap.min.css";

export interface ISantaRouteCache {
  lat: number;
  lon: number;
  seq: number;
  time?: string;
}

interface SantaDat {
  mode?: string | number;
  lon?: number;
  lng?: number;
  interval?: number;
  [key: string]: any;
}

export default function App() {
  const [santaDat, setSantaDat] = useState<SantaDat | null>(null);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [route, setRoute] = useState<ISantaRouteCache[]>([]);

  const updateFrequency = useRef(5000);
  const santaTimer = useRef<NodeJS.Timeout | null>(null);

  const primarySanta = process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL!;
  const fallbackSanta = process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL_FALLBACK;
  const primaryMrsClaus = process.env.REACT_APP_MRS_CLAUS_API_URL;
  const fallbackMrsClaus = process.env.REACT_APP_MRS_CLAUS_API_URL_FALLBACK;


  const fetchWithFallback = useCallback(
    async (primary: string, fallback: string | undefined, pathPrimary: string, pathFallback: string) => {
      try {
        const res = await axios.get(`${primary}/${pathPrimary}`);
        return { data: res.data, fallbackUsed: false };
      } catch (err) {
        console.warn("Primary failed, trying fallback...");

        if (!fallback) throw err;

        try {
          const res = await axios.get(`${fallback}/${pathFallback}`);
          return { data: res.data, fallbackUsed: true };
        } catch (err2) {
          console.error("Fallback also failed:", err2);
          throw err2;
        }
      }
    },
    []
  );

  const getSanta = useCallback(async () => {
    const primaryPath = "api/location-cache";
    const fallbackPath = "api/location-data";

    clearTimeout(santaTimer.current as any);

    try {
      const { data, fallbackUsed } = await fetchWithFallback(
        primarySanta,
        fallbackSanta,
        primaryPath,
        fallbackPath
      );

      if (data.lon) data.lng = data.lon;

      if (!fallbackUsed && typeof data.interval === "number" && data.interval > 0) {
        updateFrequency.current = data.interval;
      } else {
        updateFrequency.current = 5000;
      }

      setSantaDat(data);
    } catch (err) {
      console.error("Santa fetch failed:", err);
    } finally {
      santaTimer.current = setTimeout(getSanta, updateFrequency.current);
    }
  }, [fetchWithFallback, primarySanta, fallbackSanta]);

  const getSponsors = useCallback(async () => {
    try {
      const { data } = await fetchWithFallback(
        primaryMrsClaus!,
        fallbackMrsClaus!,
        "api/sponsor-cache",
        "api/sponsors/get-sponsors"
      );
      setSponsors(data);
    } catch (err) {
      console.error("Sponsors fetch failed:", err);
    }
  }, [fetchWithFallback, primaryMrsClaus, fallbackMrsClaus]);

  const getRoute = useCallback(async () => {
    try {
      const { data } = await fetchWithFallback(
        primarySanta,
        fallbackSanta,
        "api/flight-history",
        "api/flight-history"
      );
      setRoute(data);
    } catch (err) {
      console.error("Route fetch failed:", err);
    }
  }, [fetchWithFallback, primarySanta, fallbackSanta]);


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

  const mode = parseInt(String(santaDat?.mode ?? 0));

  return (
    <div className="WimsfoSanta">
      {mode !== 1 && (
        <Switch>
          <Route exact path="/" render={() => <AboutSection />} />
          <Route path="/about" render={() => <AboutSection />} />
          <Route path="/donate" render={() => <DonateSection />} />
          <Route path="/funding" render={() => <FundStatus />} />
          <Route
            path="/santa"
            render={() => (
              <SantaTracker santaDat={santaDat} sponsors={sponsors} route={route} />
            )}
          />
          <Route path="/sponsors" render={() => <SponsorsSection sponsors={sponsors} />} />
          <Route path="/contact" render={() => <ContactSection />} />
        </Switch>
      )}

      {mode === 1 && <SantaTracker santaDat={santaDat} sponsors={sponsors} route={route} />}

      <div id="snackbar">snacks</div>
    </div>
  );
}