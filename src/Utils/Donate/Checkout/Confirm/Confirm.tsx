import { Component } from "react"
import { Modal, Button, Spinner } from "react-bootstrap"
import LaughingSanta from "../../../LaughingSanta/LaughingSanta"
import "./Confirm.css"

interface ConfirmProps {
    confirm: Function
    cancelConfirm: Function
    name: string
    email: string
    amount: string
    loading: boolean
}

class Confirm extends Component<ConfirmProps, {}> {

    render() {

        console.log(this.props.loading)

        return (
            <div className="Confirm">
                <Modal
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        <div className="confirm-dialog-header">
                            <p>Confirm Donation</p>
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <LaughingSanta
                            message={"406"}
                        />
                        <div className="confirm-content-name-email">
                            <p>Name: {this.props.name}</p>
                            <p>Email: {this.props.email}</p>
                        </div>
                        <div className="confirm-content-amount">
                            <p>Amount: $ </p>
                            <p className="confirm-content-amount-green">{this.props.amount}</p>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <div className="confirm-dialog-footer">
                            {!this.props.loading && <Button id="confirm-dialog-footer-back" variant="secondary" onClick={(event) => this.props.cancelConfirm(event)}>Back</Button>}
                            {!this.props.loading && <Button onClick={(event) => this.props.confirm(event)} variant="primary">Donate ${this.props.amount}</Button>}
                            {this.props.loading && <Spinner id="donate-loading-spinner" animation="border" />}
                        </div>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default Confirm