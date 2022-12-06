import { Component } from "react"
import LaughingSanta from "../../Utils/LaughingSanta/LaughingSanta"
import Snow from "../../Utils/Snow/Snow"
import "./PreShow.css"

interface PreShowProps {
    santaDat: any
}

class PreShow extends Component<PreShowProps, {}> {

    render() {

        let message = this.props.santaDat.message || null

        return (
            <div className="PreShow">
                <Snow />
                <div className="preshow-info-card">
                    <div className="preshow-info-card-header">
                        <p id="preshow-info-card-header-p1">Looks like Santa is still at the North Pole.</p>
                        <p id="preshow-info-card-header-p2">When he starts to move you can interact with the map.</p>
                    </div>
                    <div className="preshow-info-card-message">
                        {!message && <p>When he is on the move you can come back here, and it will turn into a tracker to help you locate him.</p>}
                        {message && <p>{message}</p>}
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