import { Component } from "react"
import Map from "./Tracker/Tracker"
import cookieMonster from "./CookieMonster/CookieMonster"
import 'bootstrap/dist/css/bootstrap.min.css'
// import connection from "./Santa/Santa"

type WimsfoTypes = {
  preShow: boolean
  runShow: boolean
  endShow: boolean
  returnUser: boolean
  signalRMessage: object
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
      returnUser: false,
      signalRMessage: { blank: true }
    }
  }

  componentDidMount() {
    if (cookieMonster.getCookie("ReturnUser")) {
      this.setState({ returnUser: true })
    } else {
      cookieMonster.setCookie("ReturnUser", "true", 8)
    }
    // connection.on("newMessage", this.signalRIn)
  }

  componentWillUnmount() {
    clearInterval(this.listenInterval)
  }

  signalRIn = (input: object) => {
    this.setState({ signalRMessage: input })
  }


  render() {
    return (
      <div className="Wimsfo-Santa">
        {/* <input type="button" id="toggle" value="Wake Lock is disabled" style={{display: "none"}} /> */}
        {this.state.runShow && <div className="Run-Show">
          <Map />
        </div>}
      </div>
    )
  }
}

export default App