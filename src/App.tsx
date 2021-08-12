import { Component } from "react"
import Map from "./Tracker/Tracker"
import cookies from "./Cookies/Cookies"
import NoSleep from 'nosleep.js';

import 'bootstrap/dist/css/bootstrap.min.css'

type WimsfoTypes = {
  preShow: boolean
  runShow: boolean
  endShow: boolean
  returnUser: boolean
}

class App extends Component<{}, WimsfoTypes>{

  noSleep = new NoSleep();

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
    if (cookies.getCookie("ReturnUser")) {
      this.setState({ returnUser: true })
    } else {
      cookies.setCookie("ReturnUser", "true", 8)
    }
    this.noSleep.enable()
  }

  componentWillUnmount(){
    this.noSleep.disable()
  }

  render() {
    return (
      <div className="Wimsfo-Santa">
        {this.state.runShow && <div className="Run-Show">

          <Map/>
        
        </div>}
      </div>
    )
  }
}

export default App