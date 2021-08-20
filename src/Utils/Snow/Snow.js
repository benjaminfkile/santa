import { Component } from 'react'
import snow from "./SnowLogic"
import './Snow.css'

class Snow extends Component {

    componentDidMount() {
        snow.renderSnow("snow")
    }

    render() {

        return (
            <div id="snow"></div>
        )
    }
}

export default Snow