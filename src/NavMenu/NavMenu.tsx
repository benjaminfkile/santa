import { Component } from "react"
import { Link } from "react-router-dom"
import Mistletoe from "../SVG/Mistletoe/Mistletoe"
import Stocking from "../SVG/Stocking/Stocking"
import LaughingSanta from "../Utils/LaughingSanta/LaughingSanta"
import "./NavMenu.css"

type NavTypes = {
    menuOpen: boolean
}

class NavMenu extends Component<{}, NavTypes> {

    state = {
        menuOpen: false
    }

    componentDidMount() {
        this.setState({ menuOpen: false })
    }

    componentWillUnmount() {
        this.setState({ menuOpen: false })
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
                        <div className="AboutRoute" tabIndex={1} onClick={this.toggleMenu}>
                            <Link to='/about'>
                                <div id="about-route-btn-wrapper">
                                    <div className="NavMenuMistletoe">
                                        <Mistletoe />
                                    </div>
                                    <p id="about-route-text">About</p>
                                </div>
                            </Link>
                        </div>
                        <div className="DonateRoute" tabIndex={1} onClick={this.toggleMenu}>
                            <Link to='/donate'>
                                <div id="donate-route-btn-wrapper">
                                    <div className="NavMenuStocking">
                                        <Stocking />
                                    </div>
                                    <p id="donate-route-text">Donate</p>
                                </div>
                            </Link>
                        </div>
                        {/* <div className="SponsorsRoute" tabIndex={1} onClick={this.toggleMenu}>
                            <Link to='/sponsors'>
                                <div id="sponsors-route-btn-wrapper">
                                    <img src="/res/sponsors-icon.png" alt="" />
                                    <p id="sponsors-route-text">Sponsors</p>
                                </div>
                            </Link>
                        </div> */}
                        <div className="TrackerRoute" tabIndex={2} onClick={this.toggleMenu}>
                            <Link to='/santa'>
                                <div id="tracker-route-btn-wrapper">
                                    <div className="NavMenuLaughingSantaWrapper">
                                        <LaughingSanta
                                            message="406"
                                        />
                                    </div>
                                    <p id="tracker-route-text">Santa</p>
                                </div>
                            </Link>
                        </div>
                        {/* <div className="ContactRoute" tabIndex={2} onClick={this.toggleMenu}>
                            <Link to='/contact'>
                                <div id="contact-route-btn-wrapper">
                                    <span className="material-icons">mail</span>
                                    <img src="/res/wishlist.png" alt="" />
                                    <p id="tracker-route-text">Contact</p>
                                </div>
                            </Link>
                        </div> */}
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

