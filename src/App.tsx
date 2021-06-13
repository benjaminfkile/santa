import React, { Component } from "react"
import Map from "./Tracker/Tracker"
import Santa from "./Santa/Santa"
import 'bootstrap/dist/css/bootstrap.min.css'

type WimsfoTypes = {
  preShow: boolean
  runShow: boolean
  endShow: boolean
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
    }

  }

  componentDidMount() {
    Santa.getSantaData()
    this.listen()
    this.interval = 5000
    this.listenInterval = setInterval(this.listen, this.interval)
  }

  listen = () => {
    //@ts-ignore
    console.log(Santa.location.throttle)
    //@ts-ignore
    if (Santa.location.throttle + "" !== this.interval + "") {
      //@ts-ignore
      this.interval = parseInt(Santa.location.throttle)
      clearInterval(this.listenInterval)
      //@ts-ignore
      this.listenInterval = setInterval(this.listen, this.interval)
      console.log("new throttle profile")
    } else {
      Santa.getSantaData()
    }
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