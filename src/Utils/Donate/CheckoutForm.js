import { Component } from "react"
import axios from "axios"
import Cards from "react-credit-cards"
import { ElementsConsumer, CardElement } from "@stripe/react-stripe-js"
import CardSection from "./CardSection"
import { Button, Modal } from "react-bootstrap"
import DonateToolkit from "./DonateToolkit"
import 'react-credit-cards/es/styles-compiled.css'
import "./CheckoutForm.css"

class CheckoutForm extends Component {

    validCardInterval

    state = {
        email: "",
        name: "",
        amount: "",
        formattedAmount: "",
        cvc: '',
        expiry: '',
        focus: '',
        number: '',
        validCard: false,
        validEmail: false,
        validName: false,
        validAmount: false,
        confirm: false
    }

    componentDidMount() {
        this.validCardInterval = setInterval(this.listenForValidCard, 500)
    }

    componentWillUnmount() {
        clearInterval(this.validCardInterval)
    }

    handleInputFocus = (e) => {
        this.setState({ focus: e.target.name })
    }

    listenForValidCard = () => {
        let cardElement = document.getElementById("card-element-wrapper")
        if (cardElement.getElementsByClassName("StripeElement--complete").length > 0) {
            if (!this.state.validCard) {
                this.setState({ validCard: true })
            }
        } else {
            if (this.state.validCard) {
                this.setState({ validCard: false })
            }
        }
        if (this.state.amount === "" && this.state.validAmount) {
            this.setState({ validAmount: false })
        }
        if (this.state.name === "" && this.state.validName) {
            this.setState({ validName: false })
        }
    }

    handleInputChange = (e) => {
        const { name, value } = e.target

        if (name === "name") {
            if (name !== "") {
                this.setState({ [name]: value, validName: true })
            } else {
                this.setState({ [name]: "", validName: false })
            }
        }

        if (name === "email") {
            this.setState({ [name]: value })
            this.validateMail(value)
        }

        if (name === "amount") {
            if (!isNaN(value)) {
                this.setState({ formattedAmount: this.formatCurrency(value), [name]: value, validAmount: true })
            } else {
                this.setState({ formattedAmount: "", [name]: "", validAmount: false })
            }
        }
    }

    validateMail = (email) => {
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
        this.setState({ validEmail: re.test(email.toLowerCase()) })
    }

    formatCurrency = (input) => {

        return input.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
        });
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
                axios.post(`${process.env.REACT_APP_MRS_CLAUS_API_URL}/api/donate/createCharge`, rb).then(res => {
                    DonateToolkit.toggleDonate()
                    this.setState({
                        email: "",
                        name: "",
                        amount: "",
                        formattedAmount: "",
                        cvc: '',
                        expiry: '',
                        focus: '',
                        number: '',
                        validCard: false,
                        validEmail: false,
                        validName: false,
                        validAmount: false,
                    })
                }).catch(err => {
                    console.log(err)
                })
            }
        }
    }

    toggleConfirm = () => {
        if (this.state.confirm) {
            this.setState({ confirm: false })

        } else {
            this.setState({ confirm: true })

        }
    }

    render() {

        // console.log("Valid Name: ", this.state.validName)
        // console.log("Valid Email: ", this.state.validEmail)
        // console.log("Form Complete: ", this.state.validCard)

        return (
            <div>
                <Modal
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        <div className="donate-header">
                            <p>Donate</p>
                        </div>
                    </Modal.Header>
                    <Modal.Body>
                        <Cards
                            cvc={this.state.cvc}
                            expiry={this.state.expiry}
                            focused={this.state.focus}
                            name={this.state.name}
                            number={this.state.number}
                        />
                        <div className="donate-form-wrapper">
                            <div className="non-secure-form-wrapper">
                                <div className="form-group-wrapper">
                                    {this.state.validName && <span className="material-icons field-valid">done</span>}
                                    {!this.state.validName && <span className="material-icons field-invalid">close</span>}
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
                                </div>
                                <div className="form-group-wrapper">
                                    {this.state.validEmail && <span className="material-icons field-valid">done</span>}
                                    {!this.state.validEmail && <span className="material-icons field-invalid">close</span>}
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
                                </div>
                                <div className="form-group-wrapper">
                                    {this.state.validAmount && <span className="material-icons field-valid">done</span>}
                                    {!this.state.validAmount && <span className="material-icons field-invalid">close</span>}
                                    <div className="form-group">
                                        <input
                                            type="text"
                                            name="amount"
                                            value={this.state.formattedAmount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
                                            onPaste={(e) => e.preventDefault()}
                                            onChange={this.handleInputChange}
                                            onFocus={this.handleInputFocus}
                                            id="amount"
                                            className="form-control form-control-md"
                                            placeholder="Amount USD"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="card-section-validation">
                                {this.state.validCard && <span className="material-icons field-valid">done</span>}
                                {!this.state.validCard && <span className="material-icons field-invalid">close</span>}
                            </div>
                            <div id="card-section-wrapper">
                                <CardSection />
                            </div>
                        </div>
                    </Modal.Body>
                    <Modal.Footer>
                        <div className="donate-footer">
                            <Button id="donate-cancel-btn" variant="danger" onClick={() => DonateToolkit.toggleDonate()}>Cancel</Button>
                            {this.state.validName && this.state.validEmail && this.state.validCard && this.state.validAmount && <Button id="donate-form-complete-btn" onClick={this.toggleConfirm}>Next</Button>}
                            {(!this.state.validName || !this.state.validEmail || !this.state.validCard || !this.state.validAmount) && <Button id="donate-form-incomplete-btn" variant="secondary" disabled={true}>Next</Button>}
                        </div>
                    </Modal.Footer>
                </Modal>
                {this.state.confirm && <Modal
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        confirm
                    </Modal.Header>
                    <Modal.Body>

                    </Modal.Body>
                    <Modal.Footer>
                        <Button onClick={this.handleSubmit}>Confirm</Button>
                    </Modal.Footer>
                </Modal>}
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