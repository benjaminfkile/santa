import { FunctionComponent } from "react";
import { Modal, Button } from "react-bootstrap";
import "./RouteDisclaimer.css";

interface Props {
    onClose: () => void;
    isInTracker?: boolean
}

const RouteDisclaimer: FunctionComponent<Props> = ({ onClose, isInTracker }) => {
    return (
        <Modal
            show
            centered
            keyboard={false}
            onHide={onClose}
            dialogClassName="rd-dialog"
            contentClassName="rd-content-night"
        >
            <Modal.Header>
                <Modal.Title>Disclaimer</Modal.Title>
            </Modal.Header>

            <Modal.Body>
                <p style={{ marginBottom: "1rem" }}>
                    The route and times shown are estimates and may change due to weather
                    or other unforeseen circumstances at the pilot’s discretion.
                </p>

                <p style={{ marginBottom: "1rem" }}>
                    Times represent the expected arrival from liftoff to the shown point.
                </p>

                {isInTracker && <p style={{ marginBottom: "0" }}>
                    Route lines and time labels can be toggled on or off in the menu.
                </p>}
            </Modal.Body>

            <Modal.Footer>
                <Button variant="primary" onClick={onClose}>
                    I Understand
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default RouteDisclaimer;
