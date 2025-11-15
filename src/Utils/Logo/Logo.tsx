import { Component } from "react"
import "./Logo.css"

class Logo extends Component {

    render() {
        return (
            <div className="Logo">
                <div className="LogoWrapper">
                    <img id="logo-img-1" src="/res/wmsfo-logo.png" alt="" />
                    <img id="logo-img-2" src="https://wmsfo-bucket.s3.us-west-2.amazonaws.com/site-content/sponsor_logos/MDF_Lettermark_Wordmark_2Line_FullColor.png" alt="" />
                </div>
            </div>
        )
    }

}

export default Logo