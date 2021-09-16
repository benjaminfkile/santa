import { Component } from "react"
import { Modal, Button } from "react-bootstrap"
import DonateToolkit from "../../DonateToolkit"
import "./Fail.css"

class Fail extends Component {

    render() {
        return (
            <div className="Fail">
                <Modal
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        <div className="donate-fail-header">
                            <p>Error</p>
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <div className="donate-fail-body">
                            <p id="donate-fail-thing">(˚Δ˚)b</p>
                            <p id="donate-fail-description">Sorry, we cant process your card right now.  Please try again later.</p>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button onClick={() => DonateToolkit.toggleDonate()}>Ok</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default Fail