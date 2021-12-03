import { Component } from "react"
import { Route, Switch } from "react-router-dom"
import axios from "axios"
import SantaTracker from "./SantaTracker/SantaTracker"
import AboutSection from "./AboutSection/AboutSection"
import DonateSection from "./DonateSection/DonateSection"
import FundStatus from "./FundStatus/FundStatus"
import SponsorsSection from "./SponsorsSection/SponsorsSection"
import ContactSection from "./ContactSection/ContactSection"
import 'bootstrap/dist/css/bootstrap.min.css'
import fundData from "./Utils/FundsRing/FundData"


type AppTypes = {
  santaDat: any
}

class App extends Component<{}, AppTypes>{

  state = {
    santaDat: null,
  }

  updateFrequency = 5000
  getSantaInterval: any

  componentDidMount() {
    this.getSanta()
    fundData.getFundData()
    //eslint-disable-next-line
    console.log("\n  .-\"\"-.\r\n \/,..___\\\r\n() {_____}\r\n  (\/-@-@-\\)\r\n  {`-=^=-\'}\r\n  {  `-\'  }\r\n   {     }\r\n    `---\'\n\nDeveloped by Ben Kile\n\n")
  }

  componentWillUnmount() {
    clearInterval(this.getSantaInterval)
  }

  getSanta = () => {
    // console.log("getting santa every " + this.updateFrequency + " ms")
    axios.get(`${process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL}/api/location-data`)
      .then(res => {
        if (res.data) {
          this.setState({ santaDat: res.data })
        }
        if (res.data.throttle !== this.updateFrequency) {
          clearInterval(this.getSantaInterval)
          this.updateFrequency = res.data.throttle * 1000
          this.getSantaInterval = setInterval(this.getSanta, this.updateFrequency)
        }
      })
  }


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
            path='/funding'
            render={() => <FundStatus />}
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
        <div id="snackbar">snacks</div>
      </div>
    )
  }
}

export default App