import { Component } from "react"
import NavMenu from "../NavMenu/NavMenu"
import FundsRing from "../Utils/FundsRing/FundsRing"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Logo from "../Utils/Logo/Logo"
import Ornaments from "../Utils/Ornaments/Ornaments"
import "./FundStatus.css"

class FundStatus extends Component {
    render() {
        return (
            <div className="FundStatus">
                <NavMenu />
                <Logo />
                <Ornaments />
                <JumpingElf />
                <div className="FundStatusBody">
                    <div className="FundStatusBodyHeader">
                        <p>The donation tracker is updated on Monday and Friday evenings. Donations made throughout the week and on these days may not be reflected until the following update.</p>
                    </div>
                    <div className="FundStatusRingWrapper">
                        <FundsRing />
                    </div>
                    <p id="amount-needed">Flight Cost: $5,000</p>
                </div>
            </div>
        )
    }
}

export default FundStatus