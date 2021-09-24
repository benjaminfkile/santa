import { Component } from "react"
import NavMenu from "../../NavMenu/NavMenu"
import LaughingSanta from "../../Utils/LaughingSanta/LaughingSanta"
import Snow from "../../Utils/Snow/Snow"
import "./PreShow.css"

class PreShow extends Component {

    render() {
        return (
            <div className="PreShowContainer">
                <NavMenu />
                <Snow />
                <div className="preshow-info-card">
                    <div className="preshow-info-card-header">
                        <p id="preshow-info-card-header-p1">Looks like Santa is still at the North Pole.</p>
                        <p id="preshow-info-card-header-p2">When he starts to move you can interact with the map.</p>
                    </div>
                    <div className="preshow-info-card-message">
                        <p>Important updates about Santas flight such as weather and flight status will show up here.</p>
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

export default PreShow