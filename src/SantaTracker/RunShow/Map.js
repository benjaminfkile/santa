import { Component } from 'react';
import MapKey from "./MapKeys"
import './Map.css'

class Map extends Component {

    constructor(props) {
        super(props);
        this.onScriptLoad = this.onScriptLoad.bind(this)
    }

    onScriptLoad() {
        const map = new window.google.maps.Map(
            document.getElementById(this.props.id),
            this.props.options);
        this.props.onMapLoad(map)
    }

    componentDidMount() {
        if (!window.google) {
            var s = document.createElement('script')
            s.type = 'text/javascript'
            s.src = MapKey.mapUrl
            var x = document.getElementsByTagName('script')[0]
            x.parentNode.insertBefore(s, x)
            s.addEventListener('load', e => {
                this.onScriptLoad()
            })
        } else {
            this.onScriptLoad()
        }
    }

    render() {
        return (
            <div className="Map" style={{ width: "100vw", height: "100vh" }} id={this.props.id} />
        );
    }
}

export default Map