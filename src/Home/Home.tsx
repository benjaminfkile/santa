import { Component } from "react"
import Donate from "../Utils/Donate/Donate"

interface HomeProps {
    santaDat: any
}

type HomeTypes = {

}

class Home extends Component<HomeProps, HomeTypes> {
    render() {
        return (
            <div className="Home">
                <Donate/>
            </div>
        )
    }
}

export default Home