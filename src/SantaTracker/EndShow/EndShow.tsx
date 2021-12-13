import { Component } from "react"
import SponsorTypes from "../../SponsorsSection/SponsorTypes"

interface EndShowProps {
    sponsors: SponsorTypes
}

type EndShowTypes = {

}

class Endshow extends Component<EndShowProps, EndShowTypes> {

    state = {
        
    }

    render() {
        return (
            <div className="EndShow">

            </div>
        )
    }
}

export default Endshow