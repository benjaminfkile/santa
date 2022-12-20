import { Component } from "react";
import userLocation from "./UserLocation";
import { Button, Modal } from "react-bootstrap";
import "./LocationPromt.css"

interface LocationPromptProps {
    toggleLocationPrompt: Function
    theme: string
    getUserLocation: Function
}

type LocationPromptTypes = {
}

class LocationPrompt extends Component<LocationPromptProps, LocationPromptTypes> {

    handleUserRevokeLocation = () => {
        userLocation.disable = true
        this.props.toggleLocationPrompt()
    }

    handleUserAllowLocation = () => {
        userLocation.disable = false
        this.props.toggleLocationPrompt()
        if (!userLocation.inApp()) {
            userLocation.getUserLocation()
            setInterval(() => {
                userLocation.getUserLocation()
            }, 5000)
        } else {
            userLocation.getUserLocation()
        }
    }

    render() {
        return (
            <div className="LocationPrompt">
                {userLocation.disable && <Modal id={`location-prompt-modal-${this.props.theme.toLowerCase()}`}
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        <div className="LocationPromptCustomModalHeader" id={`location-prompt-custom-modal-header-${this.props.theme.toLowerCase()}`}>
                            <p>Enable Location Services?</p>
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="LocationPromptCustomModalBody" id={`location-prompt-custom-modal-body-${this.props.theme.toLowerCase()}`}>
                            <p>If you choose to allow your location you can get real-time updates about your distance from Semi-Truck Santa.</p>
                            <p>Clicking "Ok" will launch a location prompt in your browser window and you will be asked if you want to allow 406santa.org to access your device’s location.</p>
                            <p className="LocationPromtYellowParagraph">If you are visiting this website from Facebook, Instagram, or Firefox there might be issues keeping your location updated and relative to Santa.</p>
                            <p className="LocationPromtGreenParagraph">Location services work best in Chrome, Edge, and Safari browsers.</p>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button onClick={() => this.handleUserAllowLocation()}>Ok</Button>
                        <Button variant="secondary" onClick={() => this.props.toggleLocationPrompt()}>Back</Button>
                    </Modal.Footer>
                </Modal>}
                {!userLocation.disable && <Modal id={`location-prompt-modal-${this.props.theme.toLowerCase()}`}
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        <div className="LocationPromptCustomModalHeader" id={`location-prompt-custom-modal-header-${this.props.theme.toLowerCase()}`}>
                            <p>Disable Location Services?</p>
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="LocationPromptCustomModalBody" id={`location-prompt-custom-modal-body-${this.props.theme.toLowerCase()}`}>
                            <p>You can always re-enable location services if you would like.</p>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="danger" onClick={() => this.handleUserRevokeLocation()}>Disable</Button>
                        <Button variant="secondary" onClick={() => this.props.toggleLocationPrompt()}>Back</Button>
                    </Modal.Footer>
                </Modal>}
            </div>
        )
    }
}

export default LocationPrompt