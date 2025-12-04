import { Component } from "react"
import TreeLoader from "../Utils/TreeLoader/TreeLoader"
import Endshow from "./EndShow/EndShow"
import PreShow from "./PreShow/PreShow"
import Runshow from "./RunShow/Runshow"
//@ts-ignore
import NoSleep from 'nosleep.js'
import { ISantaFlyoverData, ISantaRoute, ISponsor } from "../interfaces"

interface Props {
    santaFlyoverData: ISantaFlyoverData | null
    sponsors: ISponsor[]
    route: ISantaRoute[]
}

type Types = {
    loading: boolean
}

class SantaTracker extends Component<Props, Types> {

    loadHandlerInterval: any
    loadHandlerStep = 0
    loadHandlerSpeed = 1000
    noSleep = new NoSleep()

    state = {
        loading: true,
    }

    componentDidMount() {
        this.loadHandlerInterval = setInterval(this.loadHandler, this.loadHandlerSpeed)
        try {
            this.noSleep.enable()
        } catch (error) {
            console.error(error)
        }
    }

    componentWillUnmount() {
        try {
            this.noSleep.disable()
        } catch (error) {
            console.error(error)
        }
    }

    loadHandler = () => {
        this.loadHandlerStep++
        if (this.props.santaFlyoverData && this.loadHandlerStep > 2) {
            this.setState({ loading: false })
            clearInterval(this.loadHandlerInterval)
        }
    }

    render() {

        const props = this.props
        const state = this.state
        const loading = state.loading
        const santaDat = props.santaFlyoverData
        let mode = null
        if (santaDat) {
            mode = santaDat.mode + ""
        }

        //mode = "1"

        return (
            <div className="SantaTracker">
                {!loading && santaDat && mode === "0" && <div className="PreShow">
                    <PreShow
                        santaFlyoverData={this.props.santaFlyoverData}
                    />
                </div>}
                {!loading && santaDat && mode === "1" && this.props.santaFlyoverData && this.props.santaFlyoverData.lat && <div className="RunShow">
                    <Runshow
                        santaFlyoverData={this.props.santaFlyoverData}
                        sponsors={this.props.sponsors}
                        route={this.props.route}
                    />
                </div>}
                {!loading && santaDat && mode === "2" && this.props.santaFlyoverData && this.props.santaFlyoverData.lat && <div className="RunShow">
                    <Endshow
                        sponsors={this.props.sponsors}
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