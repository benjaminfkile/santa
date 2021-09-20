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
                        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. A condimentum vitae sapien pellentesque habitant morbi tristique. Odio pellentesque diam volutpat commodo sed egestas egestas fringilla. Quisque egestas diam in arcu. Purus sit amet volutpat consequat mauris nunc congue. Molestie nunc non blandit massa enim nec dui. Commodo viverra maecenas accumsan lacus vel facilisis volutpat. Quam adipiscing vitae proin sagittis nisl rhoncus mattis rhoncus. Ullamcorper morbi tincidunt ornare massa eget egestas. Aliquet porttitor lacus luctus accumsan. Scelerisque felis imperdiet proin fermentum leo vel orci porta. At imperdiet dui accumsan sit amet nulla. Nunc consequat interdum varius sit.</p>
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