import React, { Component } from "react"
import { Button } from "react-bootstrap"
import "./TrackerMenu.css"

interface TrackerMenuProps {
    changeTheme: Function
    toggleMapTypes: Function
    mapType: string
    availableThemes: Array<any>
    currentTheme: string
    toggleSnow: Function
}

type TrackerMenuTypes = {
    menuOpen: boolean
    mapTypeId: string
}

class TrackerMenu extends Component<TrackerMenuProps, TrackerMenuTypes> {

    constructor(props: TrackerMenuProps) {
        super(props)
        this.state = {
            menuOpen: false,
            mapTypeId: this.props.mapType
        }
    }

    toggleMenu = () => {
        if (this.state.menuOpen) {
            this.setState({ menuOpen: false })
        } else {
            this.setState({ menuOpen: true })
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
        this.props.toggleSnow()
    }

    render() {

        console.log(this.props)

        return (
            <div className="TrackerMenu">
                {!this.state.menuOpen && <div className="TrackerMenuBtn" id={this.props.currentTheme.toLowerCase() + "-theme-menu-btn"} onClick={this.toggleMenu}>
                    <span className="material-icons">menu</span>
                </div>}
                {this.state.menuOpen && <div className="TrackerMenuContent" id={this.props.currentTheme.toLowerCase() + "-theme-menu-content"}>
                    <div className="TrackerMenuThemes" id={"tracker-menu-themes-" + this.props.currentTheme.toLowerCase()}>
                        {this.props.availableThemes.map((theme: any, index: number) =>
                            <div className="TrackerMenuTheme" id={"tracker-menu-theme-" + this.props.currentTheme.toLowerCase()} onClick={() => this.props.changeTheme(index)}>
                                <img src={"./res/map-theme-icons/" + theme.title.toLowerCase() + ".PNG"} alt=""></img>
                                <p>{theme.title}</p>
                            </div>
                        )}
                    </div>
                    {this.state.mapTypeId === "terrain" && <Button variant="secondary" onClick={() => this.toggleMapTypes()}>Roadmap</Button>}
                    {this.state.mapTypeId === "roadmap" && <Button variant="secondary" onClick={() => this.toggleMapTypes()}>Terrain</Button>}
                    <br></br>
                    <br></br>
                    <Button id="tracker-menu-snow-btn" variant="secondary" onClick={this.toggleSnow}>Snow</Button>
                    <div className="TrackerMenuFooter">
                        <Button id="tracker-menu-close-btn" variant="secondary" onClick={this.toggleMenu}>Close</Button>
                    </div>
                </div>}
            </div>
        )
    }

}

export default TrackerMenu

