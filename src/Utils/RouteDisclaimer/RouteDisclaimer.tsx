import { FunctionComponent } from "react";
import { Modal, Button } from "react-bootstrap";
import "./RouteDisclaimer.css"

interface Props {
    onClose: () => void;
    theme?: string
}

const RouteDisclaimer: FunctionComponent<Props> = ({ onClose, theme }) => {
    return (
        <div
            className={`RouteDisclaimer RouteDisclaimer-${theme ? theme.toLowerCase() : "night"}`}
        >
            <Modal
                show
                onHide={onClose}
                centered
                backdrop="static"
                keyboard={false}
                id={`route-disclaimer-modal-${theme ? theme.toLowerCase() : "night"}`}

            >
                <Modal.Header>
                    <Modal.Title>Disclaimer</Modal.Title>
                </Modal.Header>

                <Modal.Body>
                    <p style={{ marginBottom: "1rem" }}>
                        The route and times shown are estimates and may change due to weather
                        or other unforeseen circumstances at the pilot’s discretion.
                    </p>
                    <p>
                        Times represent the expected arrival from liftoff to the shown point.
                    </p>
                </Modal.Body>

                <Modal.Footer>
                    <Button variant="primary" onClick={onClose}>
                        I Understand
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default RouteDisclaimer;