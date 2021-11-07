import { Component } from "react"
import { Link } from "react-router-dom"
import "./LogoSmall.css"

interface LogoProps {
    id?: string
}

class Logo extends Component<LogoProps, {}> {
    render() {
        return (
            <div className="Logo" id={this.props.id || "wmsfo-unaltered-logo"}>
                <Link to='/about'>
                    <img src="/res/wmsfo-logo.png" alt="wmsfo-logo" />
                </Link>
            </div>
        )
    }
}

export default Logo