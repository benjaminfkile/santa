import { Component } from "react"
import "./SnowMan.css"

class SnowMan extends Component {

    render() {
        return (
            <div className="SnowMan">
                <div className="snowman">
                    <div className="body">
                        <div className="head"></div>
                        <div className="hat"></div>
                        <div className="scarf"></div>
                        <div className="buttons"></div>
                        <div className="hands">
                            <div className="right-hand"></div>
                            <div className="left-hand"></div>
                        </div>
                        <div className="shadow"></div>
                    </div>
                </div>
            </div>
        )
    }
}

export default SnowMan