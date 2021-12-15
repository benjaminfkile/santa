import { Component } from "react"
import LaughingSanta from "../../Utils/LaughingSanta/LaughingSanta"
import Snow from "../../Utils/Snow/Snow"
import "./PreShow.css"

interface PreShowProps {
    santaDat: any
}

class PreShow extends Component<PreShowProps, {}> {

    render() {

        return (
            <div className="PreShow">
                <Snow />
                <div className="SemiSantaHeader">
                    <p>Semi Santa</p>
                </div>
                <div className="preshow-info-card">
                    <div className="preshow-info-card-header">
                        <p id="preshow-info-card-header-p1">Semi Santa will be visiting the Walmart on Mullen, Ashley Furniture, and all the Missoula Albertsons stores on: Dec 22nd – 10:30am – 5:00pm Dec 23rd – 9:00am – 5:00pm</p>
                        {/* <p id="preshow-info-card-header-p2">When he starts to move you can interact with the map.</p> */}
                    </div>
                    <div className="preshow-info-card-message">
                        <p>When he is on the move you can come back here, and it will turn into a tracker to help you locate him.</p>
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