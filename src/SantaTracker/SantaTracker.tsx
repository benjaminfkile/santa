import { Component } from "react";
import Runshow from "./RunShow/Runshow"

interface SantaTrackerProps {
    santaDat: any
}

type SantaTrackerTypes = {
    preShow: boolean
    runShow: boolean
    endShow: boolean
    returnUser: boolean
}

class SantaTracker extends Component<SantaTrackerProps, SantaTrackerTypes> {

    state = {
        preShow: false,
        runShow: true,
        endShow: false,
        returnUser: false,
    }

    render() {
        return (
            <div className="SantaTracker">
                {this.state.runShow && this.props.santaDat && this.props.santaDat.lat && <div className="RunShow">
                    <Runshow
                        santaDat={this.props.santaDat}
                    />
                </div>}
            </div>
        )
    }
}

export default SantaTracker