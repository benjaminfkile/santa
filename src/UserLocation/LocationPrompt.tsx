import { Component } from "react";
import userLocation from "./UserLocation";
import { Button, Modal } from "react-bootstrap";
import "./LocationPromt.css"

interface LocationPromptProps {
    toggleLocationPrompt: Function
    theme: string
}

type LocationPromptTypes = {
}

class LocationPrompt extends Component<LocationPromptProps, LocationPromptTypes> {

    state = {

    }

    handleUserAllowLocation = () => {
        userLocation.getUserLocation()
        this.props.toggleLocationPrompt()
    }

    render() {
        return (
            <div className="LocationPrompt">
                <Modal id={`location-prompt-modal-${this.props.theme.toLowerCase()}`}
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
                            <p>If you choose to allow your location you can get real time updates about your distance from Santa.</p>
                            <p>Your location will not be shared or saved anywhere.</p>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button onClick={() => this.handleUserAllowLocation()}>Allow</Button>
                        <Button onClick={() => this.props.toggleLocationPrompt()}>Back</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default LocationPrompt