import { Component } from "react"
import TreeLoader from "../Utils/TreeLoader/TreeLoader"
import Endshow from "./EndShow/EndShow"
import PreShow from "./PreShow/PreShow"
import Runshow from "./RunShow/Runshow"
import NoSleep from 'nosleep.js'

interface SantaTrackerProps {
    santaDat: any
    sponsors: any
}

type SantaTrackerTypes = {

    loading: boolean
}

class SantaTracker extends Component<SantaTrackerProps, SantaTrackerTypes> {

    loadHandlerInterval: any
    loadHandlerStep = 0
    loadHandlerSpeed = 1000
    noSleep = new NoSleep()

    state = {
        loading: true,
    }

    componentDidMount() {
        this.loadHandlerInterval = setInterval(this.loadHandler, this.loadHandlerSpeed)
        this.noSleep.enable()
    }

    componentWillUnmount(){
        this.noSleep.disable()
    }

    loadHandler = () => {
        this.loadHandlerStep++
        if (this.props.santaDat && this.loadHandlerStep > 2) {
            this.setState({ loading: false })
            clearInterval(this.loadHandlerInterval)
        }
    }

    render() {//bump

        const props = this.props
        const state = this.state

        const loading = state.loading
        const santaDat = props.santaDat
        let mode = null
        if (santaDat) {
            mode = santaDat.mode + ""
        }

        // mode = "0"

        return (
            <div className="SantaTracker">
                {!loading && santaDat && mode === "0" && <div className="PreShow">
                    <PreShow
                        santaDat={this.props.santaDat}
                    />
                </div>}
                {!loading && santaDat && mode === "1" && this.props.santaDat && this.props.santaDat.lat && <div className="RunShow">
                    <Runshow
                        santaDat={this.props.santaDat}
                        sponsors={this.props.sponsors}
                    />
                </div>}
                {!loading && santaDat && mode === "2" && this.props.santaDat && this.props.santaDat.lat && <div className="RunShow">
                    <Endshow
                        sponsors={this.props.sponsors[0].sponsors}
                    />
                </div>}
                {loading &&
                    <div className="TrackerLoading">
                        <TreeLoader />
                    </div>}
            </div>
        )
    }
}

export default SantaTracker