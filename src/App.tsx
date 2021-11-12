import { Component } from "react"
import ReactGA from 'react-ga';
import { Route, Switch } from "react-router-dom"
// import axios from "axios"
// import DonateToolkit from "./Utils/Donate/DonateToolkit"
import SantaTracker from "./SantaTracker/SantaTracker"
// import Donate from "./Utils/Donate/Checkout/Donate"
import AboutSection from "./AboutSection/AboutSection"
import DonateSection from "./DonateSection/DonateSection"
// import NoSleep from 'nosleep.js'
import SponsorsSection from "./SponsorsSection/SponsorsSection"
import ContactSection from "./ContactSection/ContactSection"
import 'bootstrap/dist/css/bootstrap.min.css'


type AppTypes = {
  santaDat: any
  // donate: boolean
}

class App extends Component<{}, AppTypes>{

  // noSleep: any = new NoSleep();

  state = {
    santaDat: null,
    // donate: false
  }

  // updateInterval = 5000
  // donateInterval: any
  // checkActiveInterval: any

  componentDidMount() {
    // this.getSanta()
    // DonateToolkit.getStripe()
    // this.checkActiveInterval = setInterval(this.checkActive, this.updateInterval)
    // this.donateInterval = setInterval(this.donateListener, 100)
    if (process.env.REACT_APP_GOOGLE_ANALYTICS === "true") {
      ReactGA.initialize("G-1E2JEK81CG");
      ReactGA.pageview(window.location.pathname + window.location.search);
    }

    // try {
    //   setTimeout(() => {
    //     this.noSleep.enable()
    //   }, 5000)
    // } catch (err) {
    //   console.log("failed to enable no-sleep")
    // }
    //eslint-disable-next-line
    console.log("\n  .-\"\"-.\r\n \/,..___\\\r\n() {_____}\r\n  (\/-@-@-\\)\r\n  {`-=^=-\'}\r\n  {  `-\'  }\r\n   {     }\r\n    `---\'\n\nDeveloped by Ben Kile\n\n")
  }

  componentWillUnmount() {
    // clearInterval(this.updateInterval)
    // clearInterval(this.donateInterval)
    // this.noSleep.disable()
  }

  // donateListener = () => {
  //   if (DonateToolkit.donating) {
  //     if (!this.state.donate) {
  //       this.setState({ donate: true })
  //     }
  //   } else {
  //     if (this.state.donate) {
  //       this.setState({ donate: false })
  //     }
  //   }
  // }

  checkActive = () => {
    // if (this.noSleep._wakeLock) {
    //   if (!this.noSleep._wakeLock.released) {
    //     this.getSanta()
    //   } else {
    //     clearInterval(this.checkActiveInterval)
    //     this.checkActiveInterval = setInterval(this.checkActive, 1000)
    //   }
    // } else {
    //   this.getSanta()
    // }
    // this.getSanta()
  }

  // getSanta = () => {
  //   // console.log("updating every " + this.updateInterval)
  //   axios.get(`${process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL}/api/location-data`)
  //     .then(res => {
  //       if (res.data) {
  //         this.setState({ santaDat: res.data })
  //       }
  //       if (res.data.throttle !== this.updateInterval) {
  //         clearInterval(this.checkActiveInterval)
  //         this.updateInterval = res.data.throttle * 1000
  //         this.checkActiveInterval = setInterval(this.checkActive, this.updateInterval)
  //       }
  //     })
  // }


  render() {
    return (
      <div className="WimsfoSanta">
        <Switch>
          <Route
            exact path='/'
            render={() => <AboutSection />}
          />
          <Route
            path='/about'
            render={() => <AboutSection />}
          />
          <Route
            path='/donate'
            render={() => <DonateSection />}
          />
          <Route
            path='/santa'
            render={() => <SantaTracker
              santaDat={this.state.santaDat}
            />}
          />
          <Route
            path='/sponsors'
            render={() => <SponsorsSection />}
          />
          <Route
            path='/contact'
            render={() => <ContactSection />}
          />
        </Switch>
        {/* {this.state.donate && <Donate />} */}
        <div id="snackbar">snacks</div>
      </div>
    )
  }
}

export default App