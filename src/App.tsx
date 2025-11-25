import { Component } from "react";
import { Route, Switch } from "react-router-dom";
import axios from "axios";
import SantaTracker from "./SantaTracker/SantaTracker";
import AboutSection from "./AboutSection/AboutSection";
import DonateSection from "./DonateSection/DonateSection";
import FundStatus from "./FundStatus/FundStatus";
import SponsorsSection from "./SponsorsSection/SponsorsSection";
import ContactSection from "./ContactSection/ContactSection";
import fundData from "./Utils/FundsRing/FundData";
import SponsorTypes from "./SponsorsSection/SponsorTypes";
import "bootstrap/dist/css/bootstrap.min.css";

interface SantaDat {
  mode?: string | number;
  lon?: number;
  lng?: number;
  interval?: number;
  [key: string]: any;
}

type AppTypes = {
  santaDat: SantaDat | null;
  sponsors: Array<SponsorTypes> | any;
};

class App extends Component<{}, AppTypes> {
  state: AppTypes = {
    santaDat: null,
    sponsors: [],
  };

  updateFrequency = 5000;
  getSantaInterval: any;
  usingFallbackSanta = false;
  usingFallbackSponsors = false;

  componentDidMount() {
    this.getSanta();
    this.getSponsors();
    fundData.getFundData();
    // eslint-disable-next-line
    console.log(
      "\n  .-\"\"-.\r\n \\/,..___\\\r\n() {_____}\r\n  (\\/-@-@-\\)\r\n  {`-=^=-'}\r\n  {  `-'  }\r\n   {     }\r\n    `---'\n\nDeveloped by Ben Kile\n\n"
    );
  }

  componentWillUnmount() {
    clearTimeout(this.getSantaInterval);
  }

  /** Fetches Santa data every 5 seconds.
   * If primary fails → try fallback.
   * If fallback succeeds → next cycle starts at primary again.
   * If primary fails again → repeat the cycle.
   */
  getSanta = async (): Promise<void> => {
    const primary = process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL!;
    const fallback = process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL_FALLBACK;

    const primaryPath = "api/location-cache";
    const fallbackPath = "api/location-data";

    try {
      // 1. Try PRIMARY
      const res = await axios.get(`${primary}/${primaryPath}`);

      let data = res.data;
      if (data.lon) data.lng = data.lon;

      // --- UPDATE OCCURS ONLY WHEN PRIMARY SUCCEEDS ---
      if (typeof data.interval === "number" && data.interval > 0) {
        this.updateFrequency = data.interval;
      }

      this.setState({ santaDat: data });
      this.usingFallbackSanta = false;
    } catch (primaryErr) {
      console.warn("Primary Santa failed, trying fallback...", primaryErr);

      // --- FALLBACK MUST RESET TO 5000 ---
      this.updateFrequency = 5000;

      if (!fallback) {
        console.error("No fallback available");
      } else {
        try {
          const res = await axios.get(`${fallback}/${fallbackPath}`);
          let data = res.data;
          if (data.lon) data.lng = data.lon;

          this.setState({ santaDat: data });
          this.usingFallbackSanta = true;
        } catch (fallbackErr) {
          console.error("Fallback Santa also failed:", fallbackErr);
        }
      }
    } finally {
      clearTimeout(this.getSantaInterval);
      this.getSantaInterval = setTimeout(this.getSanta, this.updateFrequency);
    }
  };

  /** Fetches sponsors. Always tries primary first, then fallback. */
  getSponsors = async (): Promise<void> => {
    const primary = process.env.REACT_APP_MRS_CLAUS_API_URL;
    const fallback = process.env.REACT_APP_MRS_CLAUS_API_URL_FALLBACK;

    const primaryPath = "api/sponsor-cache";
    const fallbackPath = "api/sponsors/get-sponsors";

    try {
      // Try PRIMARY
      const res = await axios.get(`${primary}/${primaryPath}`);
      this.setState({ sponsors: res.data });
      this.usingFallbackSponsors = false;
    } catch (primaryErr) {
      console.warn("Primary sponsors failed, trying fallback...", primaryErr);

      if (!fallback) return console.error("No fallback sponsor API available");

      try {
        // Try FALLBACK
        const res = await axios.get(`${fallback}/${fallbackPath}`);
        this.setState({ sponsors: res.data });
        this.usingFallbackSponsors = true;
      } catch (fallbackErr) {
        console.error("Fallback sponsors also failed:", fallbackErr);
      }
    }
  };

  render() {

    const mode = parseInt(String(this.state.santaDat?.mode ?? 0));

    return (
      <div className="WimsfoSanta">
        {mode !== 1 && <Switch>
          <Route exact path="/" render={() => <AboutSection />} />
          <Route path="/about" render={() => <AboutSection />} />
          <Route path="/donate" render={() => <DonateSection />} />
          <Route path="/funding" render={() => <FundStatus />} />
          <Route
            path="/santa"
            render={() => (
              <SantaTracker
                santaDat={this.state.santaDat}
                sponsors={this.state.sponsors}
              />
            )}
          />
          <Route
            path="/sponsors"
            render={() => (
              <SponsorsSection sponsors={this.state.sponsors} />
            )}
          />
          <Route path="/contact" render={() => <ContactSection />} />
        </Switch>}
        {mode === 1 &&
          <SantaTracker
            santaDat={this.state.santaDat}
            sponsors={this.state.sponsors}
          />
        }
        <div id="snackbar">snacks</div>
      </div>
    );
  }
}

export default App;
