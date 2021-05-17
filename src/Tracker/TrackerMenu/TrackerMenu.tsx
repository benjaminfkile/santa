import React, { Component } from "react"
import { Button } from "react-bootstrap"
import "./TrackerMenu.css"

interface TrackerMenuProps {
    changeTheme: Function
    availableThemes: Array<any>
    currentTheme: string
}

type TrackerMenuTypes = {
    menuOpen: boolean
}

class TrackerMenu extends Component<TrackerMenuProps, TrackerMenuTypes> {

    constructor(props: TrackerMenuProps) {
        super(props)
        this.state = {
            menuOpen: false
        }
    }

    toggleMenu = () => {
        if (this.state.menuOpen) {
            this.setState({ menuOpen: false })
        } else {
            this.setState({ menuOpen: true })
        }
    }

    render() {

        console.log(this.props)

        return (
            <div className="TrackerMenu">
                {!this.state.menuOpen && <div className="TrackerMenuBtn" id={this.props.currentTheme.toLowerCase() + "-theme-menu-btn"} onClick={this.toggleMenu}>
                    <span className="material-icons">settings</span>
                </div>}
                {this.state.menuOpen && <div className="TrackerMenuContent" id={this.props.currentTheme.toLowerCase() + "-theme-menu-content"}>
                    <div className="TrackerMenuThemesWrapper">
                        {this.props.availableThemes.length > 0 && this.props.availableThemes.map((theme: any, index: number) =>
                            <div className="TrackerMenuThemeSelector" key={"tracker-menu-theme-selector-" + index}>
                                <Button id="wtf" onClick={() => this.props.changeTheme(index)}>{theme.title}</Button>
                            </div>
                        )}
                    </div>
                    <Button id="tracker-menu-close-btn" onClick={this.toggleMenu}>Close</Button>
                </div>}
            </div>
        )
    }

}

export default TrackerMenu

