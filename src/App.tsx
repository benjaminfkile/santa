import { Component } from "react"
import Runshow from "./RunShow/Runshow"
import cookies from "./Utils/Cookies/Cookies"
import NoSleep from 'nosleep.js';

import 'bootstrap/dist/css/bootstrap.min.css'
import axios from "axios";

type WimsfoTypes = {
  preShow: boolean
  runShow: boolean
  endShow: boolean
  returnUser: boolean
  santaDat: any
}

class App extends Component<{}, WimsfoTypes>{

  noSleep = new NoSleep();
  updateInterval = 5000
  getSantaInterval: any

  constructor(props: {}) {
    super(props)
    this.state = {
      preShow: false,
      runShow: true,
      endShow: false,
      returnUser: false,
      santaDat: null

    }
  }

  componentDidMount() {
    this.getSanta()
    this.getSantaInterval = setInterval(this.getSanta, this.updateInterval)
    if (cookies.getCookie("ReturnUser")) {
      this.setState({ returnUser: true })
    } else {
      cookies.setCookie("ReturnUser", "true", 8)
    }
    try {
      setTimeout(() => {
        this.noSleep.enable()
      }, 5000)
    } catch (err) {
      console.log("failed to enable no-sleep")
    }
    //eslint-disable-next-line
    console.log("\n  .-\"\"-.\r\n \/,..___\\\r\n() {_____}\r\n  (\/-@-@-\\)\r\n  {`-=^=-\'}\r\n  {  `-\'  }\r\n   {     }\r\n    `---\'\n\nDeveloped by Ben Kile\n\n")
  }

  componentWillUnmount() {
    this.noSleep.disable()
  }

  getSanta = () => {
    // //@ts-ignore
    // if (this.noSleep._wakeLock) {
    //   //@ts-ignore
    //   console.log(this.noSleep._wakeLock.released)
    // }
    axios.get(`https://wmsfo-location-data.herokuapp.com/api/location-data`)
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
        {this.state.runShow && this.state.santaDat && <div className="RunShow">
          <Runshow
            santaDat={this.state.santaDat}
          />
        </div>}
      </div>
    )
  }
}

export default App