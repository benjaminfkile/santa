import React, { Component } from "react"
import { Link } from "react-router-dom"
import FeedbackSVG from "../SVG/Feedback/FeedbackSVG"
import InfoSVG from "../SVG/Info/InfoSVG"
import MoneyTransferSVG from "../SVG/MoneyTransfer/MoneyTransferSVG"
import FundsRing from "../Utils/FundsRing/FundsRing"
import LaughingSanta from "../Utils/LaughingSanta/LaughingSanta"
import "./NavMenu.css"

type NavTypes = {
    menuOpen: boolean
}

class NavMenu extends Component<{}, NavTypes> {

    wrapperRef: React.RefObject<any>

    constructor(props: {}) {
        super(props);

        this.state = {
            menuOpen: false
        }
        this.wrapperRef = React.createRef();
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    componentDidMount() {
        this.setState({ menuOpen: false })
        document.addEventListener('mousedown', this.handleClickOutside);
    }

    componentWillUnmount() {
        this.setState({ menuOpen: false })
        document.removeEventListener('mousedown', this.handleClickOutside);
    }

    handleClickOutside = (event: { target: any }) => {
        if (this.wrapperRef && !this.wrapperRef.current.contains(event.target) && this.state.menuOpen) {
            this.toggleMenu()
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

        const routes = JSON.parse(process.env.REACT_APP_ROUTES || "")

        return (
            <div className="NavMenu" ref={this.wrapperRef}>
                {!this.state.menuOpen && <div className="NavMenuBtn" onClick={this.toggleMenu}>
                    <span className="material-icons">menu</span>
                </div>}
                {this.state.menuOpen && <div className="NavMenuContent">
                    <div className="NavMenuRoutes">
                        {routes.about && <div className="NavMenuRoute" tabIndex={1} onClick={this.toggleMenu}>
                            <Link to='/about'>
                                <div className="NavMenuRouteBtn">
                                    <div className="NavMenuRouteSVG">
                                        <InfoSVG />
                                    </div>
                                    <p id="about-route-text">About</p>
                                </div>
                            </Link>
                        </div>}
                        {routes.donate && <div className="NavMenuRoute" tabIndex={2} onClick={this.toggleMenu}>
                            <Link to='/donate'>
                                <div className="NavMenuRouteBtn">
                                    <div className="NavMenuRouteSVG">
                                        <MoneyTransferSVG />
                                    </div>
                                    <p id="donate-route-text">Donate</p>
                                </div>
                            </Link>
                        </div>}
                        {routes.fundProgress && <div className="NavMenuRoute" tabIndex={2} onClick={this.toggleMenu}>
                            <Link to='/funding'>
                                <div className="NavMenuRouteBtn">
                                    <div className="NavMenuRouteSVG">
                                        <FundsRing 
                                        ringStrokeWidth={12}
                                        />
                                    </div>
                                    <p id="funding-route-text">Cheer Meter</p>
                                </div>
                            </Link>
                        </div>}
                        {routes.sponsors && <div className="NavMenuRoute" tabIndex={3} onClick={this.toggleMenu}>
                            <Link to='/sponsors'>
                                <div className="NavMenuRouteBtn">
                                    <img src="/res/sponsors-icon.png" alt="" />
                                    <p id="sponsors-route-text">Sponsors</p>
                                </div>
                            </Link>
                        </div>}
                        {routes.tracker && <div className="NavMenuRoute" tabIndex={4} onClick={this.toggleMenu}>
                            <Link to='/santa'>
                                <div className="NavMenuRouteBtn">
                                    <div className="NavMenuLaughingSantaWrapper">
                                        <LaughingSanta
                                            message="406"
                                        />
                                    </div>
                                    <p id="tracker-route-text">Track Santa</p>
                                </div>
                            </Link>
                        </div>}
                        {routes.contact && <div className="NavMenuRoute" tabIndex={5} onClick={this.toggleMenu}>
                            <Link to='/contact'>
                                <div className="NavMenuRouteBtn">
                                    <div className="NavMenuRouteSVG">
                                        <FeedbackSVG />
                                    </div>
                                    <p id="contact-route-text">Contact</p>
                                </div>
                            </Link>
                        </div>}
                    </div>
                </div>}
            </div>
        )
    }
}

export default NavMenu

