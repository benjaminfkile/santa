import { Component } from "react"
import { Elements } from "@stripe/react-stripe-js";
import DonateToolkit from "../DonateToolkit";
import CheckoutForm from "./CheckoutForm"

class Donate extends Component {

  render() {
    return (
      <div className="Donate">
        <Elements stripe={DonateToolkit.stripePromise}>
          <CheckoutForm/>
        </Elements>
      </div>
    )
  }
}

export default Donate