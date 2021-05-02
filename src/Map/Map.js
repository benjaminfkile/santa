import { Component } from "react";
import { withGoogleMap, withScriptjs, GoogleMap, Marker } from "react-google-maps";
import { mapStyles } from './NightMode'
import MapKey from './MapKeys'
import Santa from '../Santa/Santa'
import '../Map/Map.css'

class Map extends Component {

    locationInterval
    locationData
    mapMounted = false;
    defaultMapOptions = {
        styles: mapStyles,
        fullscreenControl: false,
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        gestureHandling: 'greedy',
        zoom: 8,
        minZoom: 3,
        maxZoom: 15
    };

    constructor(props) {
        super(props);
        this.state = {
            aircraft: true,
            lat: 61.9241,
            lng: 25.7482,
            dragged: false
            //61.9241° N, 25.7482° (Finland)
        }
    }

    componentDidMount() {
        this.setLocation()
        this.locationInterval = setInterval(this.setLocation, 1000)
    }

    setLocation = () => {
        const santaDat = Santa.location
        if (!this.state.aircraft && santaDat.lat) {
            this.setState({ aircraft: true })
        }
        if (JSON.stringify(santaDat) !== JSON.stringify(this.locationData)) {
            this.locationData = santaDat
            this.setState({ lat: Number(this.locationData.lat), lng: Number(this.locationData.lng) })
        }
    }

    recenter = () => {
        this.setState({ dragged: false })
    }

    dragged = () => {
        if (!this.state.dragged) {
            this.setState({ dragged: true })
        }
    }

    render() {

        return (
            <div className="Map">
                {!this.state.dragged && <GoogleMap
                    center={{ lat: this.state.lat, lng: this.state.lng }}
                    defaultOptions={this.defaultMapOptions}
                    onDrag={this.dragged}
               >
                    <>
                    </>
                    <Marker
                        position={{ lat: this.state.lat, lng: this.state.lng }}
                    />
                </GoogleMap>}
                {this.state.dragged && <GoogleMap
                    defaultCenter={{ lat: this.state.lat, lng: this.state.lng }}
                    defaultOptions={this.defaultMapOptions}
                    onDrag={this.dragged}
                >
                    <>
                    </>
                    <Marker
                        position={{ lat: this.state.lat, lng: this.state.lng }}
                    />
                </GoogleMap>}
                {this.state.dragged && <div className="Recenter-Btn">
                    <button onClick={() => this.recenter()}>recenter</button>
                </div>}
            </div>
        );
    };
}

const MapComponent = withScriptjs(withGoogleMap(Map));
// eslint-disable-next-line
export default () => (
    <MapComponent
        googleMapURL={MapKey.mapUrl}
        loadingElement={<div style={{ height: `100vh` }} />}
        containerElement={<div style={{ height: `100vh`, width: "100vw" }} />}
        mapElement={<div style={{ height: `100vh` }} />}
    />
);