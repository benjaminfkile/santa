import { Component } from "react"
import LocationPrompt from "../../../Utils/UserLocation/LocationPrompt"
import { Button } from "react-bootstrap"
import userLocation from "../../../Utils/UserLocation/UserLocation"
import DonateToolKit from "../../../Utils/Donate/DonateToolkit"
import "./Menu.css"
import { Link } from "react-router-dom"

interface TrackerMenuProps {
    changeTheme: Function
    toggleMapTypes: Function
    mapType: string
    availableThemes: Array<{ title: string, nickName: string }>
    currentTheme: string
    toggleSnow: Function
    toggleCompass: Function
    menuOpen: Function
    santaDat: {
        accuracy: string,
        alt: string,
        bear: string,
        lat: string,
        lng: string,
        speed: string
    }
    getUserLocation: Function
    toggleDonate: Function
    distanceFromUserToSanta: any
}

type TrackerMenuTypes = {
    menuOpen: boolean
    mapTypeId: string
    snow: boolean
    compass: boolean
    locationPrompt: boolean
    donate: boolean
}

class TrackerMenu extends Component<TrackerMenuProps, TrackerMenuTypes> {

    state = {
        menuOpen: false,
        mapTypeId: this.props.mapType,
        snow: false,
        compass: false,
        locationPrompt: false,
        donate: false
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

    toggleCompass = () => {
        if (this.state.compass) {
            this.setState({ compass: false })
        } else {
            this.setState({ compass: true })
        }
        this.props.toggleCompass()
    }

    render() {

        return (
            <div className="TrackerMenu">
                {!this.state.menuOpen && <div className="TrackerMenuBtn" id={this.props.currentTheme.toLowerCase() + "-theme-menu-btn"} onClick={this.toggleMenu}>
                    <span className="material-icons">menu</span>
                </div>}
                {this.state.menuOpen && <div className="TrackerMenuContent" id={this.props.currentTheme.toLowerCase() + "-theme-menu-content"}>
                    <div className="TrackerMenuThemes" id={"tracker-menu-themes-" + this.props.currentTheme.toLowerCase()}>
                        {this.props.availableThemes.map((theme, index) =>
                            <div className="TrackerMenuTheme" id={"tracker-menu-theme-" + this.props.currentTheme.toLowerCase()} key={"tracker-menu-theme-" + index} onClick={() => this.props.changeTheme(index)}>
                                <img src={"./res/map-theme-icons/" + theme.title.toLowerCase() + ".PNG"} alt=""></img>
                                <p>{theme.nickName}</p>
                            </div>
                        )}
                    </div>
                    <div className="TrackerMenuMapTypeWrapper">
                        {this.state.mapTypeId !== "terrain" && <Button className="TerrainToggle" id="terrain-toggled-off" onClick={() => this.toggleMapTypes()}><span className="material-icons">terrain</span><p>Terrain</p></Button>}
                        {this.state.mapTypeId === "terrain" && <Button className="TerrainToggle" id="terrain-toggled-on" disabled={true}><span className="material-icons">terrain</span><p>Terrain</p></Button>}
                        {this.state.mapTypeId === "roadmap" && <Button className="RoadMapToggle" id="roadmap-toggled-on" disabled={true}><span className="material-icons">map</span><p>Roadmap</p></Button>}
                        {this.state.mapTypeId !== "roadmap" && <Button className="RoadMapToggle" id="roadmap-toggled-off" onClick={() => this.toggleMapTypes()}><span className="material-icons">map</span><p>Roadmap</p></Button>}
                        {!this.state.snow && <Button id="snow-toggled-off" className="SnowToggle" onClick={this.toggleSnow}><span className="material-icons">ac_unit</span><p>Snow</p></Button>}
                        {this.state.snow && <Button id="snow-toggled-on" className="SnowToggle" onClick={this.toggleSnow}><span className="material-icons">ac_unit</span><p>Snow</p></Button>}
                    </div>
                    <div className="TrackerMenuSantaDatWrapper" id={"tracker-menu-santa-dat-wrapper-" + this.props.currentTheme.toLowerCase()}>
                        {/* {this.props.santaDat.accuracy && <div className="TrackerMenuSantaDatItem" id={"tracker-menu-santa-dat-item-" + this.props.currentTheme.toLowerCase()}>
                            <span className="material-icons">360</span>
                            <p>{this.props.santaDat.accuracy.split("+")[0]} ft</p>
                        </div>} */}
                        {this.props.santaDat.bear && <div className="TrackerMenuSantaDatItem" id={"tracker-menu-santa-dat-item-" + this.props.currentTheme.toLowerCase()}>
                            <span className="material-icons">explore</span>
                            <p>{this.props.santaDat.bear.split("+")[0]}</p>
                        </div>}
                        {this.props.santaDat.alt && <div className="TrackerMenuSantaDatItem" id={"tracker-menu-santa-dat-item-" + this.props.currentTheme.toLowerCase()}>
                            <span className="material-icons">flight_takeoff</span>
                            <p>{this.props.santaDat.alt.split("+")[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ft</p>
                        </div>}
                        {this.props.santaDat.speed && <div className="TrackerMenuSantaDatItem" id={"tracker-menu-santa-dat-item-" + this.props.currentTheme.toLowerCase()}>
                            <span className="material-icons">speed</span>
                            <p>{this.props.santaDat.speed.split("+")[0]} mph</p>
                        </div>}
                    </div>
                    {!userLocation.disable && this.props.distanceFromUserToSanta && <div className="DistanceFromUserToSantaTrackerMenu" id={"distance-from-user-to-santa-tracker-menu-" + this.props.currentTheme.toLowerCase()}>
                        {this.props.distanceFromUserToSanta < 5281 &&
                            <div id="distance-from-user-to-santa-menu-pill-wrapper">
                                <img id="santa-hat-menu-user-loc" src="./res/santa-hat.png" alt=""></img>
                                <p>{this.props.distanceFromUserToSanta.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ft</p>
                            </div>}
                        {this.props.distanceFromUserToSanta > 5280 &&
                            <div id="distance-from-user-to-santa-menu-pill-wrapper">
                                <img id="santa-hat-menu-user-loc" src="./res/santa-hat.png" alt=""></img>
                                <p> {((this.props.distanceFromUserToSanta / 5280).toFixed(2)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} mi</p>
                            </div>}
                    </div>}
                    <div className="TrackerMenuFooter">
                        {!userLocation.disable && <div className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${this.props.currentTheme.toLowerCase()}`} id={"tracker-menu-location-btn-allowed-" + this.props.currentTheme.toLowerCase()} onClick={this.toggleLocationPrompt}><span className="material-icons">my_location</span></div>}
                        {userLocation.disable && <div className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${this.props.currentTheme.toLowerCase()}`} id={"tracker-menu-location-btn-denied-" + this.props.currentTheme.toLowerCase()} onClick={this.toggleLocationPrompt}><span className="material-icons">location_disabled</span></div>}
                        <div className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${this.props.currentTheme.toLowerCase()}`}>
                            {/* <div className="TrackerMenuDonateBtn" id={"tracker-menu-donate-btn-" + this.props.currentTheme.toLowerCase()} onClick={() => DonateToolKit.toggleDonate()}><p><span className="material-icons">attach_money</span></p></div> */}
                            <div className="TrackerMenuHomeBtn">
                                <Link to='/about'>
                                    <span id={"tracker-menu-home-btn-" + this.props.currentTheme.toLowerCase()} className="material-icons">home</span>
                                </Link>
                            </div>
                        </div>
                        {!userLocation.disable && <div id={"tracker-menu-compass-btn-" + this.props.currentTheme.toLowerCase()} className={`TrackerMenuFooterBtn TrackerMenuFooterBtn-${this.props.currentTheme.toLowerCase()}`} onClick={() => this.toggleCompass()}><span className="material-icons">explore</span></div>}
                        <div className={`TrackerMenuCloseBtn TrackerMenuFooterBtn-${this.props.currentTheme.toLowerCase()}`} id={"tracker-menu-close-btn-" + this.props.currentTheme.toLowerCase()} onClick={this.toggleMenu}><p><span className="material-icons">clear</span></p></div>
                    </div>
                </div>}
                {this.state.locationPrompt &&
                    <LocationPrompt
                        toggleLocationPrompt={this.toggleLocationPrompt}
                        theme={this.props.currentTheme}
                        getUserLocation={this.props.getUserLocation}
                    />}
            </div>
        )
    }
}

export default TrackerMenu

