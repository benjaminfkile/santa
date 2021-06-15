import { Component } from "react"
import Map from "./Tracker/Tracker"
import Santa from "./Santa/Santa"
import cookieMonster from "./CookieMonster/CookieMonster"
import 'bootstrap/dist/css/bootstrap.min.css'

type WimsfoTypes = {
  preShow: boolean
  runShow: boolean
  endShow: boolean
  returnUser: boolean
}

class App extends Component<{}, WimsfoTypes>{

  listenInterval: any
  interval: any
  constructor(props: any) {
    super(props)
    this.state = {
      preShow: false,
      runShow: true,
      endShow: false,
      returnUser: false
    }
  }

  componentDidMount() {
    Santa.getSantaData()
    this.listen()
    this.interval = 1000
    this.listenInterval = setInterval(this.listen, this.interval)
    if (cookieMonster.getCookie("ReturnUser")) {
      this.setState({ returnUser: true })
    } else {
      cookieMonster.setCookie("ReturnUser", "true", 8)
    }
  }

  componentWillUnmount() {
    clearInterval(this.listenInterval)
  }

  listen = () => {
    //@ts-ignore
    if (Santa.location.throttle + "" !== this.interval + "") {
      //@ts-ignore
      this.interval = parseInt(Santa.location.throttle)
      clearInterval(this.listenInterval)
      this.listenInterval = setInterval(this.listen, this.interval)
      console.log("new throttle profile")
    }
    Santa.getSantaData()
  }

  render() {
    return (
      <div className="Wimsfo-Santa">
        {this.state.runShow && <div className="Run-Show">
          <Map />
        </div>}
      </div>
    )
  }
}

export default App