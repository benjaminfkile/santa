import { Component } from "react"
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import CheckoutForm from "./CheckoutForm"
import "./Donate.css"

const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_TEST_KEY);

class Donate extends Component {


  render() {
    return (
      <div className="Donate">
        <Elements stripe={stripePromise}>
          <CheckoutForm />
        </Elements>
      </div>
    )
  }
}

export default Donate