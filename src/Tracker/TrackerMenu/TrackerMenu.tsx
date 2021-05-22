import React, { Component } from "react"
import { Button } from "react-bootstrap"
import "./TrackerMenu.css"

interface TrackerMenuProps {
    changeTheme: Function
    toggleMapTypes: Function
    mapType: string
    availableThemes: Array<any>
    currentTheme: string
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

    render() {

        console.log(this.props)

        return (
            <div className="TrackerMenu">
                {!this.state.menuOpen && <div className="TrackerMenuBtn" id={this.props.currentTheme.toLowerCase() + "-theme-menu-btn"} onClick={this.toggleMenu}>
                    <span className="material-icons">settings</span>
                </div>}
                {this.state.menuOpen && <div className="TrackerMenuContent" id={this.props.currentTheme.toLowerCase() + "-theme-menu-content"}>
                    <div className="TrackerMenuThemesWrapper" id={"tracker-menu-themes-wrapper-" + this.props.currentTheme.toLowerCase()}>
                        {this.props.availableThemes.length > 0 && this.props.availableThemes.map((theme: any, index: number) =>
                            <div className="ThemeToggleBtnWrapper" id={theme.title.toLowerCase() + "-theme-toggle-btn"} key={"theme-toggle-btn-" + index} onClick={() => this.props.changeTheme(index)}>
                                <img src={"./res/map-theme-icons/" + theme.title.toLowerCase() + ".PNG"} alt=""></img>
                            </div>)}
                    </div>
                    <div className="MapTypeIdWrapper">
                        {this.state.mapTypeId === "terrain" && <Button variant="secondary" onClick={() => this.toggleMapTypes()}>Roadmap</Button>}
                        {this.state.mapTypeId === "roadmap" && <Button variant="secondary" onClick={() => this.toggleMapTypes()}>Terrain</Button>}
                    </div>
                    <div className="TrackerMenuFooter">
                        <Button id="tracker-menu-close-btn" variant="secondary" onClick={this.toggleMenu}>Close</Button>
                    </div>
                </div>}
            </div>
        )
    }

}

export default TrackerMenu

