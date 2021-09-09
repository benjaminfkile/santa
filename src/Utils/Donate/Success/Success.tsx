import { Component } from "react"
import { Modal, Button } from "react-bootstrap"
import DonateToolkit from "../DonateToolkit"
import Confetti from 'react-confetti'
import LaughingSanta from "../../LaughingSanta/LaughingSanta"
import "./Success.css"

type SuccessTypes = {
    confetti: boolean
}

class Success extends Component<{}, SuccessTypes> {

    state = {
        confetti: true
    }

    render() {

        return (
            <div className="Success">
                <Modal
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        <div className="donate-success-header">
                            <p>Success!</p>
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        {this.state.confetti &&
                            <Confetti
                                width={500}
                                height={410}
                                colors={["#165B33", "#146B3A", "#F8B229", "#EA4630", "#BB2528"]}
                            />}
                        <LaughingSanta
                            message="406"
                        />
                        <div className="donate-success-content">
                            <p id="donate-success-content-p1">Thank you for your donation!</p>
                            <p id="donate-success-content-p2">Mrs. Claus emailed you a receipt.</p>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <div className="donate-success-footer">
                            <Button onClick={() => DonateToolkit.toggleDonate()}>Ok</Button>
                        </div>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default Success