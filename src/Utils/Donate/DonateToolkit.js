import { loadStripe } from "@stripe/stripe-js";
let DonateToolkit = {
    stripePromise: null,
    donating: false,
    getStripe() {
        if (process.env.REACT_APP_STRIPE_TESTING === "true") {
            DonateToolkit.stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_TEST_KEY)
            console.log("Stripe Mode: *Test*")
        } else {
            DonateToolkit.stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY)
            console.log("Stripe Mode: *Live*")
        }
    },
    toggleDonate() {
        if (DonateToolkit.donating) {
            DonateToolkit.donating = false
        } else {
            DonateToolkit.donating = true
        }
    }
}
export default DonateToolkit