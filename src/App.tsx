import { Component } from "react"
import { Route, Switch } from "react-router-dom"
import axios from "axios"
import Home from "./Home/Home"
import SantaTracker from "./SantaTracker/SantaTracker"
import 'bootstrap/dist/css/bootstrap.min.css'



type AppTypes = {
  santaDat: any
}

class App extends Component<{}, AppTypes>{

  state = {
    santaDat: null
  }

  updateInterval = 5000
  getSantaInterval: any

  componentDidMount() {
    this.getSanta()
    this.getSantaInterval = setInterval(this.getSanta, this.updateInterval)
    //eslint-disable-next-line
    console.log("\n  .-\"\"-.\r\n \/,..___\\\r\n() {_____}\r\n  (\/-@-@-\\)\r\n  {`-=^=-\'}\r\n  {  `-\'  }\r\n   {     }\r\n    `---\'\n\nDeveloped by Ben Kile\n\n")
  }

  componentWillUnmount() {
    clearInterval(this.updateInterval)
  }

  getSanta = () => {
    // console.log("updating every " + this.updateInterval)
    axios.get(`${process.env.REACT_APP_WMSFO_LOCATION_DATA}/api/location-data`)
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

  render() {
    return (
      <div className="WimsfoSanta">
        <Switch>
          <Route
            exact path='/'
            render={() => <SantaTracker santaDat={this.state.santaDat} />}
          />
          <Route
            path='/santa'
            render={() => <SantaTracker santaDat={this.state.santaDat} />}
          />
          <Route
            path='/donate'
            render={() => <Home santaDat={this.state.santaDat} />}
          />
          {/* <Route path='/skills' component={Skills} />
          <Route path='/projects' component={Projects} />
          <Route path='/contact' component={Contact} /> */}
          <Route
            render={() => <SantaTracker santaDat={this.state.santaDat} />}
          />
        </Switch>
      </div>
    )
  }
}

export default App