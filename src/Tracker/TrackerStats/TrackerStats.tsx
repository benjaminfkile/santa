import { Component } from "react"
import "./TrackerStats.css"

interface TrackerStatsProps {
    santaDat: any
    currentTheme: any
}

type TrackerStatsTypes = {
    showStats: boolean
}

class TrackerStats extends Component<TrackerStatsProps, TrackerStatsTypes> {

    constructor(props: TrackerStatsProps) {
        super(props)
        this.state = {
            showStats: true
        }
    }

    toggleStats = () => {

    }

    render() {

        // console.log(this.props)

        return (
            <div className="TrackerStats">
                {this.state.showStats && this.props.santaDat.accuracy && <div id="stats-accuracy-wrapper">
                    <div className="TrackerStatsWrapper" id={"tracker-menu-stats-wrapper-" + this.props.currentTheme.toLowerCase()}>
                        <div id="stats-item-wrapper">
                            {/* <p>~</p> */}
                            <p>{this.props.santaDat.accuracy.split("+")[0]} {this.props.santaDat.accuracy.split("+")[1]}</p>
                        </div>
                        <div id="stats-item-wrapper">
                            {/* <p>~</p> */}
                            <p>{this.props.santaDat.alt.split("+")[0]} {this.props.santaDat.alt.split("+")[1]}</p>
                        </div>
                        <div id="stats-item-wrapper">
                            {/* <p>~</p> */}
                            <p>{this.props.santaDat.bear.split("+")[0]} {this.props.santaDat.bear.split("+")[1]}</p>
                        </div>
                        <div id="stats-item-wrapper">
                            {/* <p>~</p> */}
                            <p>{this.props.santaDat.speed.split("+")[0]} {this.props.santaDat.speed.split("+")[1]}</p>
                        </div>
                    </div>
                </div>}
            </div>
        )
    }
}

export default TrackerStats