import { Component } from "react"
import NavMenu from "../NavMenu/NavMenu"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import Ornaments from "../Utils/Ornaments/Ornaments"
import "./ContactSection.css"

class ContactSection extends Component {
    render() {
        return (
            <div className="ContactSection">
                <NavMenu />
                <JumpingElf />
                <Ornaments />
                contact section
            </div>
        )
    }
}

export default ContactSection