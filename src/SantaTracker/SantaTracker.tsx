import { Component } from "react"
import PreShow from "./PreShow/PreShow"
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

    render() {//.env bump
        return (
            <div className="SantaTracker">
                {this.state.preShow && <div className="PreShow">
                    <PreShow />
                </div>}
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