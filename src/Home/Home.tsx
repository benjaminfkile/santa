import { Component } from "react"

interface HomeProps {
    santaDat: any
}

type HomeTypes = {

}

class Home extends Component<HomeProps, HomeTypes> {
    render() {
        return (
            <div className="Home">
                home
            </div>
        )
    }
}

export default Home