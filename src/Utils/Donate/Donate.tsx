import { Component } from "react"
import axios from "axios"
import { Button, FormControl, Modal } from "react-bootstrap"
import { Elements } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import Cards from "react-credit-cards"
import "react-credit-cards/es/styles-compiled.css"
import "./Donate.css"

interface DonateProps {
    // toggleDonate: Function
}

type DonateTypes = {
    cvc: string
    expiryMonth: string
    expiryYear: string
    focus: string
    name: string
    number: string
    email: string
    zip: string
    amt: string
    postal: string
}

class Donate extends Component<DonateProps, DonateTypes> {

    stripePromise: any = null

    state = {
        cvc: "",
        expiryMonth: "",
        expiryYear: "",
        focus: "",
        name: "",
        number: "",
        email: "",
        zip: "",
        amt: "",
        postal: ""
    }

    handleInputFocus = (e: any) => {
        this.setState({ focus: e.target.name })
    }

    handleInputChange = (e: any) => {
        let { name, value } = e.target
        //@ts-ignore
        this.setState({ [name]: value })
    }

    componentDidMount() {
        this.stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || "")
    }

    setInfo = (info: any) => {
        console.log(info)
    }

    submit = () => {
        let rb = {
            oneTime: true,
            amount: this.state.amt,
            cardNumber: this.state.number,
            cardExpMonth: this.state.expiryMonth,
            cardExpYear: `20${this.state.expiryYear}`,
            cardCVC: this.state.cvc,
            country: "US", //fix this
            postalCode: this.state.postal
        }
        console.log(rb)
        axios.post(`${process.env.REACT_APP_MRS_CLAUS}/api/donate/createCharge`, rb)
            .then(res => {
                console.log(res.data)
            }).catch(err => {
                console.log(err)
            })
    }

    render() {
        return (
            <div className="Donate">
                <Modal
                    show={true}
                    keyboard={false}
                >
                    <Modal.Header>
                        <div >
                            <p>Donate</p>
                        </div>
                    </Modal.Header>
                    <div className="PaymentForm">
                        <Elements stripe={this.stripePromise}>
                            <Cards
                                cvc={this.state.cvc}
                                expiry={`${this.state.expiryMonth}/${this.state.expiryYear}`}
                                //@ts-ignore
                                focused={this.state.focus}
                                name={this.state.name}
                                number={this.state.number}
                            />

                            <div className="PayFormRow" id="pay-form-row-1">
                                <FormControl
                                    type="email"
                                    name="email"
                                    placeholder="Email"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />

                            </div>
                            <div className="PayFormRow">
                                <FormControl
                                    type="text"
                                    name="name"
                                    placeholder="Name"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />

                            </div>
                            <div className="PayFormRow">
                                <FormControl
                                    autoComplete="cc-number"
                                    x-autocompletetype="cc-number"
                                    pattern="\d*"
                                    type="text"
                                    name="number"
                                    placeholder="Card Number"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                            </div>

                            <div className="PayFormRow" id="pay-form-row-exp-csv" >
                                <FormControl
                                    autoComplete="cc-exp-month"
                                    x-autocompletetype="cc-exp-month"
                                    type="text"
                                    name="expiryMonth"
                                    placeholder="MM"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                                <FormControl
                                    autoComplete="cc-exp-year"
                                    x-autocompletetype="cc-exp-year"
                                    type="number"
                                    name="expiryYear"
                                    placeholder="YY"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                                <FormControl
                                    autoComplete="cc-csc"
                                    x-autocompletetype="cc-csc"
                                    type="text"
                                    name="cvc"
                                    placeholder="CSC"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                            </div>
                            <div className="PayFormRow">
                                <FormControl
                                    type="number"
                                    min="1"
                                    step="any"
                                    name="amt"
                                    placeholder="Amount"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                            </div>
                            <div className="PayFormRow">
                                <FormControl
                                    type="number"
                                    name="postal"
                                    pattern="^(?(^00000(|-0000))|(\d{5}(|-\d{4})))$"
                                    placeholder="Zip"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                            </div>
                        </Elements>
                    </div>
                    <Modal.Footer>
                        <Button onClick={() => this.submit()}>Submit</Button>
                        {/* <Button onClick={() => this.props.toggleDonate()}>Back</Button> */}
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default Donate