import { Component } from "react"
import NavMenu from "../NavMenu/NavMenu"
import FundsRing from "../Utils/FundsRing/FundsRing"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Logo from "../Utils/Logo/Logo"
import Ornaments from "../Utils/Ornaments/Ornaments"
import "./FundStatus.css"

class FundStatus extends Component {
    render() {//bump
        return (
            <div className="FundStatus">
                <NavMenu />
                <Logo />
                <Ornaments />
                <JumpingElf />
                <div className="FundStatusBody">
                    <div className="FundStatusBodyHeader">
                        <p>Cheer Meter</p>
                    </div>
                    <div className="FundStatusBodyText">
                        <p>Updates are made on Monday and Friday evenings. Donations made throughout the week or on these days may not be reflected until the following update.</p>
                    </div>
                    <div className="FundStatusRingWrapper">
                        <FundsRing />
                    </div>
                    <p id="amount-needed">Santa's Goal: $5,000</p>
                </div>
            </div>
        )
    }
}

export default FundStatus