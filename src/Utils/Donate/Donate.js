import { Component } from "react";
import { Button, Modal } from "react-bootstrap";
import Cards from "react-credit-cards"
import 'react-credit-cards/es/styles-compiled.css';
import "./Donate.css"

class Donate extends Component {

    state = {
        cvc: '',
        expiry: '',
        focus: '',
        name: '',
        number: '',
    };

    handleInputFocus = (e) => {
        this.setState({ focus: e.target.name });
    }

    handleInputChange = (e) => {
        const { name, value } = e.target;
        this.setState({ [name]: value });
    }

    render() {
        return (
            <div className="Donate">
                <Modal id={`donate-prompt-modal-${this.props.theme.toLowerCase()}`}
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        <div className="DonatePromptCustomModalHeader" id={`donate-prompt-custom-modal-header-${this.props.theme.toLowerCase()}`}>
                            <p>Donate</p>
                        </div>
                    </Modal.Header>
                    <div id="PaymentForm">
                        <Cards
                            cvc={this.state.cvc}
                            expiry={this.state.expiry}
                            focused={this.state.focus}
                            name={this.state.name}
                            number={this.state.number}
                        />
                        <form>
                            <input
                                type="tel"
                                name="number"
                                placeholder="Card Number"
                                onChange={this.handleInputChange}
                                onFocus={this.handleInputFocus}
                            />
                            <input
                                type="tel"
                                name="expiry"
                                placeholder="Expiration"
                                onChange={this.handleInputChange}
                                onFocus={this.handleInputFocus}
                            />
                            <input
                                type="tel"
                                name="cvc"
                                placeholder="CVC"
                                onChange={this.handleInputChange}
                                onFocus={this.handleInputFocus}
                            />
                        </form>
                    </div>
                    <Modal.Footer>
                        {/* <Button onClick={() => this.handleUserAllowLocation()}>Allow</Button> */}
                        <Button onClick={() => this.props.toggleDonatePrompt()}>Back</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default Donate