import { Component } from "react"
import LocationPrompt from "../../UserLocation/LocationPrompt"
import { Button } from "react-bootstrap"
import "./TrackerMenu.css"
import userLocation from "../../UserLocation/UserLocation"

interface TrackerMenuProps {
    changeTheme: Function
    toggleMapTypes: Function
    mapType: string
    availableThemes: Array<any>
    currentTheme: string
    toggleSnow: Function
    userCoords: any
    listenForUserLocation: Function
    menuOpen: Function
}

type TrackerMenuTypes = {
    menuOpen: boolean
    mapTypeId: string
    snow: boolean
    locationPrompt: boolean
}

class TrackerMenu extends Component<TrackerMenuProps, TrackerMenuTypes> {

    constructor(props: TrackerMenuProps) {
        super(props)
        this.state = {
            menuOpen: false,
            mapTypeId: this.props.mapType,
            snow: false,
            locationPrompt: false
        }
    }

    toggleMenu = () => {
        if (this.state.menuOpen) {
            this.setState({ menuOpen: false })
            this.props.menuOpen(false)
        } else {
            this.setState({ menuOpen: true })
            this.props.menuOpen(true)
        }
    }

    toggleMapTypes = () => {
        if (this.state.mapTypeId === "terrain") {
            this.setState({ mapTypeId: "roadmap" })
        } else {
            this.setState({ mapTypeId: "terrain" })
        }
        this.props.toggleMapTypes()
    }

    toggleSnow = () => {
        if (this.state.snow) {
            this.setState({ snow: false })
        } else {
            this.setState({ snow: true })
        }
        this.props.toggleSnow()
    }

    toggleLocationPrompt = () => {
        if (this.state.locationPrompt) {
            this.setState({ locationPrompt: false })
        } else {
            this.setState({ locationPrompt: true })
        }
    }

    render() {

        // console.log(this.props)

        return (
            <div className="TrackerMenu">
                {!this.state.menuOpen && <div className="TrackerMenuBtn" id={this.props.currentTheme.toLowerCase() + "-theme-menu-btn"} onClick={this.toggleMenu}>
                    <span className="material-icons">tune</span>
                </div>}
                {this.state.menuOpen && <div className="TrackerMenuContent" id={this.props.currentTheme.toLowerCase() + "-theme-menu-content"}>
                    <div className="TrackerMenuThemes" id={"tracker-menu-themes-" + this.props.currentTheme.toLowerCase()}>
                        {this.props.availableThemes.map((theme: any, index: number) =>
                            <div className="TrackerMenuTheme" id={"tracker-menu-theme-" + this.props.currentTheme.toLowerCase()} key={"tracker-menu-theme-" + index} onClick={() => this.props.changeTheme(index)}>
                                <img src={"./res/map-theme-icons/" + theme.title.toLowerCase() + ".PNG"} alt=""></img>
                                <p>{theme.nickName}</p>
                            </div>
                        )}
                    </div>
                    <div className="TrackerMenuMapTypeWrapper">
                        {this.state.mapTypeId !== "terrain" && <Button className="TerrainToggle" id="terrain-toggled-off" onClick={() => this.toggleMapTypes()}><span className="material-icons">terrain</span><p>Terrain</p></Button>}
                        {this.state.mapTypeId === "terrain" && <Button className="TerrainToggle" id="terrain-toggled-on" disabled={true}><span className="material-icons">terrain</span><p>Terrain</p></Button>}
                        {this.state.mapTypeId === "roadmap" && <Button className="RoadMapToggle" id="terrain-toggled-on" disabled={true}><span className="material-icons">map</span><p>Roadmap</p></Button>}
                        {this.state.mapTypeId !== "roadmap" && <Button className="RoadMapToggle" id="terrain-toggled-off" onClick={() => this.toggleMapTypes()}><span className="material-icons">map</span><p>Roadmap</p></Button>}
                        {!this.state.snow && <Button id="snow-toggled-off" className="SnowToggle" onClick={this.toggleSnow}><span className="material-icons" onClick={this.toggleSnow}>ac_unit</span><p>Snow</p></Button>}
                        {this.state.snow && <Button id="snow-toggled-on" className="SnowToggle" onClick={this.toggleSnow}><span className="material-icons" onClick={this.toggleSnow}>ac_unit</span><p>Snow</p></Button>}
                    </div>
                    <br></br>
                    <br></br>
                    <div className="TrackerMenuFooter">
                        {this.state.locationPrompt &&
                            <LocationPrompt
                                toggleLocationPrompt={this.toggleLocationPrompt}
                                theme={this.props.currentTheme}
                            />}
                        {!userLocation.disable && <Button id="tracker-menu-location-btn-allowed" variant="secondary" onClick={this.toggleLocationPrompt}><p><span className="material-icons">my_location</span></p></Button>}
                        {userLocation.disable && <Button id="tracker-menu-location-btn-denied" variant="secondary" onClick={this.toggleLocationPrompt}><p><span className="material-icons">location_disabled</span></p></Button>}
                        <Button id="tracker-menu-close-btn" variant="secondary" onClick={this.toggleMenu}><p><span className="material-icons">clear</span></p></Button>
                    </div>
                </div>}
            </div>
        )
    }

}

export default TrackerMenu

