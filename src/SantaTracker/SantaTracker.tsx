import { Component } from "react"
import Runshow from "./RunShow/Runshow"

interface SantaTrackerProps {
    santaDat: any
}


class SantaTracker extends Component<SantaTrackerProps, {}> {


    render() {

        return (
            <div className="SantaTracker">
                    <Runshow
                        santaDat={this.props.santaDat}
                    />
            </div>
        )
    }
}

export default SantaTracker