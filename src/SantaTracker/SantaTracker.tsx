import { Component } from "react"
import PreLoader from "../Utils/PreLoader/PreLoader"
import Endshow from "./EndShow/EndShow"
import PreShow from "./PreShow/PreShow"
import Runshow from "./RunShow/Runshow"
import "./SantaTracker.css"

interface SantaTrackerProps {
    santaDat: any
}

type SantaTrackerTypes = {

    loading: boolean
}

class SantaTracker extends Component<SantaTrackerProps, SantaTrackerTypes> {

    loadHandlerInterval: any
    loadHandlerStep = 0
    loadHandlerSpeed = 1000


    state = {
        loading: true,
    }

    componentDidMount() {
        this.loadHandlerInterval = setInterval(this.loadHandler, this.loadHandlerSpeed)
    }

    loadHandler = () => {
        this.loadHandlerStep++
        if (this.props.santaDat && this.loadHandlerStep > 2) {
            this.setState({ loading: false })
            clearInterval(this.loadHandlerInterval)
        }
    }

    render() {

        let loading = this.state.loading
        let santaDat = this.props.santaDat
        let mode = "0"
        if (santaDat) {
            mode = santaDat.mode + ""
        }

        if (santaDat) {
            santaDat.mode = "0"
        }

        return (
            <div className="SantaTracker">
                {!loading && santaDat && mode === "0" && <div className="PreShow">
                    <PreShow santaDat={this.props.santaDat} />
                </div>}
                {!loading && santaDat && mode === "1" && this.props.santaDat && this.props.santaDat.lat && <div className="RunShow">
                    <Runshow santaDat={this.props.santaDat} />
                </div>}
                {!loading && santaDat && mode === "2" && this.props.santaDat && this.props.santaDat.lat && <div className="RunShow">
                    <Endshow />
                </div>}
                {loading &&
                    <div className="TrackerLoading">
                        <PreLoader/>
                        <p>Looking for Semi Santa...</p>
                    </div>}
            </div>
        )
    }
}

export default SantaTracker