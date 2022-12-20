import { Component } from "react"
import LaughingSanta from "../../Utils/LaughingSanta/LaughingSanta"
import Snow from "../../Utils/Snow/Snow"
import "./EndShow.css"

class Endshow extends Component {

    render() {

        return (
            <div className="EndShow">
                <Snow />
                <div className="SemiSantaHeader">
                    <p>Semi-Truck Santa</p>
                </div>
                <div className="preshow-info-card">
                    <div className="preshow-info-card-header">
                        <p id="preshow-info-card-header-p1">Semi-Truck Santa has returned to the North Pole! Please check back with us next year to track Semi-Truck Santa.</p>
                        {/* <p id="preshow-info-card-header-p2">When he starts to move you can interact with the map.</p> */}
                    </div>
                    <div className="preshow-info-card-message">
                        <p>Merry Christmas!</p>
                    </div>
                    <div className="preshow-info-card-laughing-santa-wrapper">
                        <LaughingSanta
                            message="406"
                        />
                    </div>
                </div>
            </div>
        )
    }
}

export default Endshow