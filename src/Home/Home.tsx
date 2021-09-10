import { Component } from "react"
import LandingAccordion from "./Accordion/LandingAccordion"
import JumpingElf from "../Utils/JumpingElf/JumpingElf"
import "./Home.css"

interface HomeProps {
    santaDat: any
}

type HomeTypes = {

}

class Home extends Component<HomeProps, HomeTypes> {
    render() {
        return (
            <div className="Home">
                <LandingAccordion/>
                <JumpingElf/>
            </div>
        )
    }
}

export default Home