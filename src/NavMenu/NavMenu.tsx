import { Component } from "react"
import { Link } from "react-router-dom"
import "./NavMenu.css"

interface NavProps {

}

type NavTypes = {
    menuOpen: boolean
}

class NavMenu extends Component<NavProps, NavTypes> {

    state = {
        menuOpen: false
    }

    toggleMenu = () => {
        if (this.state.menuOpen) {
            this.setState({ menuOpen: false })
        } else {
            this.setState({ menuOpen: true })
        }
    }

    render() {
        return (
            <div className="NavMenu">
                {!this.state.menuOpen && <div className="NavMenuBtn" onClick={this.toggleMenu}>
                    <span className="material-icons">tune</span>
                </div>}
                {this.state.menuOpen && <div className="NavMenuContent">
                    <div className="NavMenuRoutes">
                    {/* <div className="DonateRoute" tabIndex={1}>
                            <Link to='/santa'>
                                <div id="donate-route-btn-wrapper">
                                    <img id="donate-route-icon" src="./res/santa-icon.png" alt=""></img>
                                    <p id="donate-route-text">Santa Tracker</p>
                                </div>
                            </Link>
                        </div> */}
                        <div className="TrackerRoute" tabIndex={1}>
                            <Link to='/santa'>
                                <div id="tracker-route-btn-wrapper">
                                    <img id="tracker-route-icon" src="./res/santa-icon.png" alt=""></img>
                                    <p id="tracker-route-text">Santa Tracker</p>
                                </div>
                            </Link>
                        </div>
                    </div>
                    <div className="NavMenuFooter">
                        <span id="nav-menu-close-btn" className="material-icons" onClick={this.toggleMenu}>clear</span>
                    </div>
                </div>}
            </div>
        )
    }
}

export default NavMenu

