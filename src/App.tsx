import React, { Component } from "react"
import Map from "./Map/Map"
import Santa from "./Santa/Santa"

type WimsfoTypes = {
  preShow: boolean
  runShow: boolean
  endShow: boolean
}

class App extends Component<{}, WimsfoTypes>{

  listenInterval: any
  constructor(props: any) {
    super(props)
    this.state = {
      preShow: false,
      runShow: true,
      endShow: false
    }

  }

  componentDidMount() {
    this.listen()
    this.listenInterval = setInterval(this.listen, 5000)
  }

  listen = () => {
    Santa.getSantaData()    
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