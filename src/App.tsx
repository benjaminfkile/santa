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
import authService from "./Utils/authService";
import "bootstrap/dist/css/bootstrap.min.css";

type AppTypes = {
  santaDat: any;
  sponsors: Array<SponsorTypes> | any;
};

class App extends Component<{}, AppTypes> {
  state = {
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

    // always start with primary every cycle
    const primaryPath = "api/location-cache";
    const fallbackPath = "api/location-data";

    try {
      // 1. Try PRIMARY
      const res = await axios.get(`${primary}/${primaryPath}`, {
        headers: {
          "x-device-id": authService.getDeviceId()
        }
      });
      let data = res.data;
      if (data.lon) data.lng = data.lon;

      authService.token = res.data.cookieToken

      this.setState({ santaDat: data });
      this.usingFallbackSanta = false; // reset
    } catch (primaryErr) {
      console.warn("Primary Santa failed, trying fallback...", primaryErr);

      if (!fallback) {
        console.error("No fallback available");
      } else {
        try {
          // 2. Try FALLBACK
          const res = await axios.get(`${fallback}/${fallbackPath}`);
          let data = res.data;
          if (data.lon) data.lng = data.lon;

          this.setState({ santaDat: data });
          this.usingFallbackSanta = true; // this cycle used fallback
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
    return (
      <div className="WimsfoSanta">
        <Switch>
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
        </Switch>
        <div id="snackbar">snacks</div>
      </div>
    );
  }
}

export default App;
