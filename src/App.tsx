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

  /** Fetches Santa data every 5 seconds. Once the primary fails, permanently switches to fallback. */
  getSanta = async (): Promise<void> => {
    const primary = process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL!;
    const fallback = process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL_FALLBACK;

    const activeUrl = this.usingFallbackSanta && fallback ? fallback : primary;
    const path = this.usingFallbackSanta
      ? "api/location-data"
      : "api/location-cache-open"

    try {
      const res = await axios.get(`${activeUrl}/${path}`);
      console.log(res)
      let fixed = res.data
      if (fixed.lon) {
        fixed.lng = fixed.lon
      }
      this.setState({ santaDat: fixed });
    } catch (err) {
      // Switch to fallback permanently if primary fails
      if (!this.usingFallbackSanta && fallback) {
        console.warn(
          `Primary Santa URL failed (${primary}), switching permanently to fallback: ${fallback}`
        );
        this.usingFallbackSanta = true;
      } else {
        console.error("Failed to fetch Santa data:", err);
      }
    } finally {
      clearTimeout(this.getSantaInterval);
      this.getSantaInterval = setTimeout(this.getSanta, this.updateFrequency);
    }
  };

  /** Fetch sponsors once (tries primary, falls back if needed) */
  getSponsors = async (): Promise<void> => {
    const primaryBase = process.env.REACT_APP_MRS_CLAUS_API_URL;
    const fallbackBase = process.env.REACT_APP_MRS_CLAUS_API_URL_FALLBACK;

    const activeBase =
      this.usingFallbackSponsors && fallbackBase ? fallbackBase : primaryBase;

    const path = this.usingFallbackSponsors
      ? "api/sponsors/get-sponsors"
      : "api/sponsor-cache-open";

    const url = `${activeBase}/${path}`;

    try {
      const res = await axios.get(url);
      this.setState({ sponsors: res.data });
    } catch (err) {
      if (!this.usingFallbackSponsors && fallbackBase) {
        console.warn(
          `Primary sponsors URL failed (${primaryBase}), switching permanently to fallback: ${fallbackBase}`
        );
        this.usingFallbackSponsors = true;
        return this.getSponsors(); // retry once using fallback
      } else {
        console.error("Failed to fetch sponsors:", err);
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
