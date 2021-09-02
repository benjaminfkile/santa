import { Component } from "react"
import { FormControl, Modal } from "react-bootstrap"
import { Elements } from "@stripe/react-stripe-js"
import { loadStripe } from "@stripe/stripe-js"
import Cards from "react-credit-cards"
import "react-credit-cards/es/styles-compiled.css"
import "./Donate.css"

type DonateTypes = {
    cvc: string
    expiry: string
    focus: string
    name: string
    number: string
    email: string
    zip: string
}

class Donate extends Component<{}, DonateTypes> {

    stripePromise: any = null
    months: Array<{ id: number, text: string }> =
        [
            { id: 1, text: "January" },
            { id: 2, text: "February" },
            { id: 3, text: "March" },
            { id: 4, text: "April" },
            { id: 5, text: "May" },
            { id: 6, text: "June" },
            { id: 7, text: "July" },
            { id: 8, text: "August" },
            { id: 9, text: "September" },
            { id: 10, text: "October" },
            { id: 11, text: "November" },
            { id: 12, text: "December" }
        ]

    state = {
        cvc: "",
        expiry: "",
        focus: "",
        name: "",
        number: "",
        email: "",
        zip: ""
    }

    handleInputFocus = (e: any) => {
        this.setState({ focus: e.target.name })
    }

    handleInputChange = (e: any) => {
        let { name, value } = e.target
        if (name === "expiry" && name.length > 2) {

        }
        //@ts-ignore
        this.setState({ [name]: value })
    }

    componentDidMount() {
        this.stripePromise = loadStripe("pk_live_51JTboZABqjRIuDCyK9iKUaVFynwY3b50oRwecfW6qaQeyZgyBcamBdfdB3jIBk00ihKh89AmPZSuSsih4I1MFORc00uJr4aAJP")
    }

    setInfo = (info: any) => {
        console.log(info)
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
                    <Elements stripe={this.stripePromise}>
                        <Cards
                            cvc={this.state.cvc}
                            expiry={this.state.expiry}
                            //@ts-ignore
                            focused={this.state.focus}
                            name={this.state.name}
                            number={this.state.number}
                        />

                        <div className="PaymentForm">
                            <div className="PayFormRow">
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
                                    name="expiry"
                                    placeholder="Month"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                                <FormControl
                                    autoComplete="cc-exp-year"
                                    x-autocompletetype="cc-exp-year"
                                    type="number"
                                    name="expiry"
                                    placeholder="Year"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                                <FormControl
                                    autoComplete="cc-csc"
                                    x-autocompletetype="cc-csc"
                                    type="text"
                                    name="expiry"
                                    placeholder="CSC"
                                    onChange={this.handleInputChange}
                                    onFocus={this.handleInputFocus}
                                />
                            </div>
                        </div>
                    </Elements>
                    <Modal.Footer>
                        {/* <Button onClick={() => this.handleUserAllowLocation()}>Allow</Button> */}
                        {/* <Button onClick={() => this.props.toggleDonatePrompt()}>Back</Button> */}
                    </Modal.Footer>
                </Modal>
            </div>
        )
    }
}

export default Donate