import { Component } from "react";
import userLocation from "./UserLocation";
import { Button, Modal } from "react-bootstrap";
import "./LocationPromt.css"

interface LocationPromptProps {
    toggleLocationPrompt: Function
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
                <Modal
                    show={true}
                    backdrop="static"
                    keyboard={false}
                >
                    <Modal.Header>
                        <Modal.Title>Real Time Updates</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        If you want to get real time updates about Santas distance from your location, tap the use button and allow the Santa Tracker to access your location
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="primary" onClick={() => this.handleUserAllowLocation()}>Use</Button>
                        <Button variant="secondary" onClick={() => this.props.toggleLocationPrompt()}>Back</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default LocationPrompt