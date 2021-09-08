import { Component } from "react"
import { Modal, Button } from "react-bootstrap"
import DonateToolkit from "../DonateToolkit"
import "./Success.css"

class Success extends Component {

    render() {
        return (
            <div className="Success">
                <Modal
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        Success
                    </Modal.Header>
                    <Modal.Body>
                        <div className="donate-success-content">
                            <p>Thank you for your donation</p>
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

export default Success