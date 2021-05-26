import { Component } from "react";
import Map from "./Map/Map"
import Santa from "../Santa/Santa"
import Standard from './Map/MapThemes/Standard'
import Retro from './Map/MapThemes/Retro'
import Silver from './Map/MapThemes/Silver'
import Dark from './Map/MapThemes/Dark'
import Night from './Map/MapThemes/Night'
import Aubergine from './Map/MapThemes/Aubergine'
import TrackerMenu from "./TrackerMenu/TrackerMenu"
import Snow from "../Snow/Snow"
import "./Tracker.css"

class Tracker extends Component {

    mapThemes =
        [
            { mapTheme: Standard, title: "Standard" },
            { mapTheme: Retro, title: "Retro" },
            { mapTheme: Silver, title: "Silver" },
            { mapTheme: Dark, title: "Dark" },
            { mapTheme: Night, title: "Night" },
            { mapTheme: Aubergine, title: "Aubergine" }
        ]
    map
    mapType = "terrain"
    marker
    locationInterval
    locationData
    constructor() {
        super();
        this.state = {
            lat: 46.833,
            lng: -114.030,
            currentTheme: this.mapThemes[4].title,
            snow: false
        }
    }

    componentDidMount() {
        this.setLocation()
        this.locationInterval = setInterval(this.setLocation, 1000)
    }

    setLocation = () => {
        const santaDat = Santa.location
        if ((JSON.stringify(santaDat) !== JSON.stringify(this.locationData)) && santaDat.lat) {
            this.locationData = santaDat
            this.map.setCenter({ lat: Number(this.locationData.lat), lng: Number(this.locationData.lng) })
            this.marker.setPosition({ lat: Number(this.locationData.lat), lng: Number(this.locationData.lng) })
        }
    }

    setTheme = (index) => {
        this.map.setOptions({ styles: this.mapThemes[index].mapTheme })
        this.setState({ currentTheme: this.mapThemes[index].title })
    }

    toggleTerrain = () => {
        if (this.mapType === "terrain") {
            this.mapType = "roadmap"
            this.map.setOptions({ mapTypeId: 'roadmap' })
        } else {
            this.mapType = "terrain"
            this.map.setOptions({ mapTypeId: 'terrain' })
        }
    }

    setMapOptions = (map) => {
        this.map = map
        this.map.setOptions({
            center: { lat: this.state.lat, lng: this.state.lng },
            zoom: 13,
            mapTypeControl: false,
            zoomControl: false,
            fullscreenControl: false,
            streetViewControl: false,
            gestureHandling: 'greedy',
            mapTypeId: 'terrain',
            mapTypeControlOptions: {
                mapTypeIds: ['terrain', 'roadmap', 'hybrid'],
            },
            styles: this.mapThemes[4].mapTheme
        })
    }

    toggleSnow = () => {
        if (this.state.snow) {
            this.setState({ snow: false })
        } else {
            this.setState({ snow: true })
        }
    }

    render() {

        return (

            <div className="TrackerContainer">
                <Map
                    id="Map"
                    onMapLoad={map => {
                        this.setMapOptions(map)
                        const marker = new window.google.maps.Marker(
                            {
                                position: { lat: parseFloat(this.state.lat), lng: parseFloat(this.state.lng) },
                                map: map,
                                label: '',
                            });
                        this.marker = marker
                    }}
                />
                <TrackerMenu
                    changeTheme={this.setTheme}
                    availableThemes={this.mapThemes}
                    currentTheme={this.state.currentTheme}
                    toggleMapTypes={this.toggleTerrain}
                    mapType={this.mapType}
                    toggleSnow={this.toggleSnow}

                />
                {this.state.snow && <Snow />}
            </div>
        )
    }
}

export default Tracker