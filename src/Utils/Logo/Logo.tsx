import { Component } from "react"
import { Link } from "react-router-dom"
import "./Logo.css"

interface LogoProps {
    id?: string
}

class Logo extends Component<LogoProps, {}> {
    render() {
        return (
            <div className="Logo" id={this.props.id || "wmsfo-unaltered-logo"}>
                <Link to='/about'>
                    <img src="/res/wmsfo-logo.png" />
                </Link>
            </div>
        )
    }
}

export default Logo