import { Component } from "react"
import "./LaughingSanta.css"

interface LaughingSantaProps {
    message: String
}

class LaughingSanta extends Component<LaughingSantaProps, {}> {

    render() {
        return (
            <div className="LaughingSanta">
                <div className="window">
                    <div className="santa">
                        <div className="head">
                            <div className="face">
                                <div className="redhat">
                                    <div className="whitepart"></div>
                                    <div className="redpart"></div>
                                    <div className="hatball"></div>
                                </div>
                                <div className="eyes"></div>
                                <div className="beard">
                                    <div className="nouse"></div>
                                    <div className="mouth"></div>
                                </div>
                            </div>
                            <div className="ears"></div>
                        </div>
                        <div className="body"></div>
                    </div>
                </div>
                <div className="message">
                    <p>{this.props.message}</p>
                </div>
            </div>
        )
    }
}

export default LaughingSanta