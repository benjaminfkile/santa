import React from "react"
import axios from "axios"
import { ElementsConsumer, CardElement } from "@stripe/react-stripe-js"
import CardSection from "./CardSection"
import { Button, Modal } from "react-bootstrap"

class CheckoutForm extends React.Component {

    state = {
        email: "",
        name: "",
        amount: "",
        focus: "",
    }

    handleInputFocus = (e) => {
        this.setState({ focus: e.target.name })
    }

    //function to handle  input and update the state of variable
    handleInputChange = (e) => {
        const { name, value} = e.target
        if (name === "amount") {
            if (!isNaN(parseInt(value))) {
                this.setState({ [name]: value })
            } else {
                this.setState({ [name]: "" })
            }
        } else {
            this.setState({ [name]: value })
        }
    }


    handleSubmit = async event => {
        event.preventDefault()
        if (this.state.name.length !== "" && this.state.email !== "" && this.state.amount !== "") {
            let rb = {}
            rb.name = this.state.name
            rb.email = this.state.email
            rb.amount = this.state.amount
            const { stripe, elements } = this.props
            if (!stripe || !elements) {
                return
            }

            const card = elements.getElement(CardElement)
            const result = await stripe.createToken(card)
            if (result.error) {
                console.log(result.error.message)
            } else {
                rb.token = result.token
                axios.post("https://wmsfo-ms-claus.herokuapp.com/api/donate/createCharge", rb).then(res => {
                    // console.log(res)
                }).catch(err => {
                    console.log(err)
                })
            }
        }
    }

    render() {

        return (
            <div>
                <Modal
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        Donate
                    </Modal.Header>
                    <Modal.Body>
                        <div className="form-group">
                            <input
                                type="text"
                                name="name"
                                spellCheck="false"
                                value={this.state.name}
                                autoComplete="name"
                                onPaste={(e) => e.preventDefault()}
                                onChange={this.handleInputChange}
                                onFocus={this.handleInputFocus}
                                id="cardHolder"
                                className="form-control form-control-md"
                                placeholder="Name"
                            />
                        </div>
                        <div className="form-group">
                            <input
                                type="text"
                                name="email"
                                spellCheck="false"
                                value={this.state.email}
                                autoComplete="email"
                                onPaste={(e) => e.preventDefault()}
                                onChange={this.handleInputChange}
                                onFocus={this.handleInputFocus}
                                id="email"
                                className="form-control form-control-md"
                                placeholder="Email"
                            />
                        </div>
                        <div className="form-group">
                            <input
                                type="text"
                                name="amount"
                                value={this.state.amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                onPaste={(e) => e.preventDefault()}
                                onChange={this.handleInputChange}
                                onFocus={this.handleInputFocus}
                                id="amount"
                                className="form-control form-control-md"
                                placeholder="Amount"
                            />
                        </div>
                        <CardSection />
                    </Modal.Body>
                    <Modal.Footer>
                        <Button onClick={this.handleSubmit}>Submit</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default function InjectedCheckoutForm() {
    return (
        <ElementsConsumer>
            {({ stripe, elements }) => (
                <CheckoutForm stripe={stripe} elements={elements} />
            )}
        </ElementsConsumer>
    )
}