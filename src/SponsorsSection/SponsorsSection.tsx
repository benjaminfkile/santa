import { Component } from "react"
import NavMenu from "../NavMenu/NavMenu"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Ornaments from "../Utils/Ornaments/Ornaments"
import "./SponsorsSection.css"


interface SponsorsSectionProps {

}

type SponsorsSectionTypes = {

}

class SponsorsSection extends Component<SponsorsSectionProps, SponsorsSectionTypes>{

    state = {

    }

    render() {
        return (
            <div className="SponsorsSection">
                <NavMenu/>
                <JumpingElf/>
                <Ornaments/>
                sponsors
            </div>
        )
    }
}

export default SponsorsSection