import { Component } from "react"
import userLocation from "../../UserLocation/UserLocation"
import "./TrackerStats.css"

interface TrackerStatsProps {
    santaDat: any
    currentTheme: any
    distanceFromUserToSanta: number
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
                {userLocation.coordinates.lat && this.props.distanceFromUserToSanta && <div className="DistanceFromUserToSanta" id={"distance-from-user-to-santa-" + this.props.currentTheme.toLowerCase()}>
                    {this.props.distanceFromUserToSanta < 5281 &&
                        <div id="distance-from-user-to-santa-content-wrapper">
                            <img id="distance-from-user-to-santa-icon" src="./res/santa-icon.png" alt=""></img>
                            <p>{this.props.distanceFromUserToSanta.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ft</p>
                        </div>}
                    {this.props.distanceFromUserToSanta > 5280 &&
                        <div id="distance-from-user-to-santa-content-wrapper">
                            <img id="distance-from-user-to-santa-icon" src="./res/santa-icon.png" alt=""></img>
                            <p> {((this.props.distanceFromUserToSanta / 5280).toFixed(2)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} mi</p>
                        </div>}

                </div>}
                {this.state.showStats && this.props.santaDat.accuracy && <div id="stats-accuracy-wrapper">
                    <div className="TrackerStatsWrapper" id={"tracker-menu-stats-wrapper-" + this.props.currentTheme.toLowerCase()}>
                        <div id="stats-item-wrapper">
                            <p>{this.props.santaDat.accuracy.split("+")[0]} {this.props.santaDat.accuracy.split("+")[1]}</p>
                        </div>
                        <div id="stats-item-wrapper">
                            <p>{this.props.santaDat.alt.split("+")[0]} {this.props.santaDat.alt.split("+")[1]}</p>
                        </div>
                        <div id="stats-item-wrapper">
                            <p>{this.props.santaDat.bear.split("+")[0]} {this.props.santaDat.bear.split("+")[1]}</p>
                        </div>
                        <div id="stats-item-wrapper">
                            <p>{this.props.santaDat.speed.split("+")[0]} {this.props.santaDat.speed.split("+")[1]}</p>
                        </div>
                    </div>
                </div>}
            </div>
        )
    }
}

export default TrackerStats