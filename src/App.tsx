import { Component } from "react"
import axios from "axios"
import SantaTracker from "./SantaTracker/SantaTracker"
import 'bootstrap/dist/css/bootstrap.min.css'


type AppTypes = {
  santaDat: any
}

class App extends Component<{}, AppTypes>{

  state = {
    santaDat: null,
    sponsors: []
  }

  updateFrequency = 5000
  getSantaInterval: any

  componentDidMount() {
    this.getSanta()
    //eslint-disable-next-line
    // console.log("\n  .-\"\"-.\r\n \/,..___\\\r\n() {_____}\r\n  (\/-@-@-\\)\r\n  {`-=^=-\'}\r\n  {  `-\'  }\r\n   {     }\r\n    `---\'\n\nDeveloped by Ben Kile\n\n")
  }

  componentWillUnmount() {
    clearInterval(this.getSantaInterval)
  }

  getSanta = () => {
    // console.log("getting santa every " + this.updateFrequency + " ms")
    axios.get(`${process.env.REACT_APP_SEMI_SANTA_LOCATION_DATA_API_URL}/api/location-data`)
      .then(res => {
        if (res.data) {
          this.setState({ santaDat: res.data })
          if(parseInt(res.data.redirect) === 1){
            // this.redirect()
          }
        }
        if (res.data.throttle !== this.updateFrequency) {
          clearInterval(this.getSantaInterval)
          this.updateFrequency = res.data.throttle * 1000
          this.getSantaInterval = setInterval(this.getSanta, this.updateFrequency)
        }
      })
  }

  // redirect = () => {
  //   //@ts-ignore
  //   window.location.replace(process.env.REACT_APP_REDIRECT_URL)
  // }

  
  render() {

    return (
      <div className="WimsfoSanta">
        {this.state.santaDat && <SantaTracker
          santaDat={this.state.santaDat}
        />}
        <div id="snackbar">snacks</div>
      </div>
    )
  }
}

export default App