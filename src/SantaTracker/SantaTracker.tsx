import { Component } from "react"
import TreeLoader from "../Utils/TreeLoader/TreeLoader"
import PreShow from "./PreShow/PreShow"
import Runshow from "./RunShow/Runshow"

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

        if (santaDat) {
            santaDat.mode = 1
        }

        return (
            <div className="SantaTracker">
                {!loading && santaDat && santaDat.mode === 0 && <div className="PreShow">
                    <PreShow />
                </div>}
                {!loading && santaDat && santaDat.mode === 1 && this.props.santaDat && this.props.santaDat.lat && <div className="RunShow">
                    <Runshow
                        santaDat={this.props.santaDat}
                        sponsors={this.props.sponsors}
                    />
                </div>}
                {!loading && santaDat && santaDat.mode === 2 && this.props.santaDat && this.props.santaDat.lat && <div className="RunShow">
                    end show
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