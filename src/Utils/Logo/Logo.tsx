import { Component } from "react"
import "./Logo.css"

class Logo extends Component {

    render() {
        return (
            <div className="Logo">
                <div className="LogoWrapper">
                    <img id="logo-img-1" src="/res/wmsfo-logo.png" alt="" />
                    <img id="logo-img-2" src="/res/mdf-logo.png" alt="" />
                </div>
            </div>
        )
    }

}

export default Logo