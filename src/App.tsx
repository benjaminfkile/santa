import { Component } from "react"
import 'bootstrap/dist/css/bootstrap.min.css'
import Runshow from "./RunShow/Runshow"
import cookies from "./Utils/Cookies/Cookies"
import NoSleep from 'nosleep.js';
import axios from "axios";
import Preshow from "./PreShow/PreShow";
import Snow from "./Utils/Snow/Snow";

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
      santaDat: null,
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
        if (this.state.runShow) {
          this.noSleep.enable()
        }
      }, 5000)
    } catch (err) {
      console.log("failed to enable no-sleep")
    }
    //eslint-disable-next-line
    console.log("  .-\"\"-.\r\n \/,..___\\\r\n() {_____}\r\n  (\/-@-@-\\)\r\n  {`-=^=-\'}\r\n  {  `-\'  }\r\n   {     }\r\n    `---\'")
  }

  componentWillUnmount() {
    this.noSleep.disable()
    clearInterval(this.getSantaInterval)
  }

  getSanta = () => {
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
        {this.state.preShow && <div className="PreShow">
          <Preshow
            santaDat={this.state.santaDat}
          />
        </div>}
        <Snow/>
      </div>
    )
  }
}

export default App