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
                        Fail
                    </Modal.Header>
                    <Modal.Body>

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