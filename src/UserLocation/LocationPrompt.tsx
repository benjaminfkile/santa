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

    render() {
        return (
            <div className="LocationPrompt">
                <Modal
                    show={true}
                    backdrop="static"
                    keyboard={false}
                >
                    <Modal.Header closeButton>
                        <Modal.Title>Modal title</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        I will not close if you click outside me. Don't even try to press
                        escape key.
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="primary" onClick={() => this.props.toggleLocationPrompt()}>Quit</Button>
                        <Button variant="primary" onClick={() => userLocation.getUserLocation()}>Use</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default LocationPrompt