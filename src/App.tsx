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
}

class App extends Component<{}, WimsfoTypes>{

  constructor(props: {}) {
    super(props)
    this.state = {
      preShow: false,
      runShow: true,
      endShow: false,
      returnUser: false,
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