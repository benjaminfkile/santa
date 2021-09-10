import { Component } from "react"
import { Route, Switch } from "react-router-dom"
import DonateToolkit from "./Utils/Donate/DonateToolkit";
import axios from "axios"
import Home from "./Home/Home"
import SantaTracker from "./SantaTracker/SantaTracker"
import 'bootstrap/dist/css/bootstrap.min.css'
import Donate from "./Utils/Donate/Checkout/Donate";
//so we only load stripe once and can have a reusable donate component

type AppTypes = {
  santaDat: any
  donate: boolean
}

class App extends Component<{}, AppTypes>{

  state = {
    santaDat: null,
    donate: false
  }

  updateInterval = 5000
  donateInterval: any
  getSantaInterval: any

  componentDidMount() {
    this.getSanta()
    DonateToolkit.getStripe()
    this.getSantaInterval = setInterval(this.getSanta, this.updateInterval)
    this.donateInterval = setInterval(this.donateListener, 100)
    //eslint-disable-next-line
    console.log("\n  .-\"\"-.\r\n \/,..___\\\r\n() {_____}\r\n  (\/-@-@-\\)\r\n  {`-=^=-\'}\r\n  {  `-\'  }\r\n   {     }\r\n    `---\'\n\nDeveloped by Ben Kile\n\n")
  }

  componentWillUnmount() {
    clearInterval(this.updateInterval)
    clearInterval(this.donateInterval)
  }

  donateListener = () => {
    if (DonateToolkit.donating) {
      if (!this.state.donate) {
        this.setState({ donate: true })
      }
    } else {
      if (this.state.donate) {
        this.setState({ donate: false })
      }
    }
  }

  getSanta = () => {
    // console.log("updating every " + this.updateInterval)
    axios.get(`${process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL}/api/location-data`)
      .then(res => {
        if (res.data) {
          this.setState({ santaDat: res.data })
        }
        if (res.data.throttle !== this.updateInterval) {
          clearInterval(this.getSantaInterval)
          this.updateInterval = res.data.throttle * 1000
          this.getSantaInterval = setInterval(this.getSanta, this.updateInterval)
        }
      })
  }

  toggleDonate = () => {
    if (this.state.donate) {
      this.setState({ donate: false })
    } else {
      this.setState({ donate: true })
    }
  }

  render() {
    return (
      <div className="WimsfoSanta">
        <Switch>
          <Route
            exact path='/'
            render={() => <Home
              santaDat={this.state.santaDat}
            />}
          />
          <Route
            path='/santa'
            render={() => <SantaTracker
              santaDat={this.state.santaDat}
            />}
          />
          {/* <Route
            path='/donate'
            render={() => <Home santaDat={this.state.santaDat} />}
          /> */}
          <Route
            render={() => <SantaTracker
              santaDat={this.state.santaDat}
            />}
          />
        </Switch>
        {this.state.donate && <Donate />}
      </div>
    )
  }
}

export default App