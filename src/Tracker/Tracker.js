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
import TrackerStats from "./TrackerStats/TrackerStats"
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
    updateInterval
    constructor() {
        super();
        this.state = {
            lat: 46.833,
            lng: -114.030,
            currentTheme: this.mapThemes[4].title,
            snow: false,
            santaDat: {}
        }
    }

    componentDidMount() {
        Santa.getSantaData()
        this.updateInterval = setInterval(this.setLocation, 500)
    }

    componentWillUnmount(){
        clearInterval(this.updateInterval)
      }

    setLocation = () => {
        const santaDat = Santa.location
        if ((JSON.stringify(santaDat) !== JSON.stringify(this.state.santaDat)) && santaDat.lat) {
            this.setState({ santaDat: santaDat })
            this.map.setCenter({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
            this.marker.setPosition({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
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
            zoom: 10,
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

        console.log("tracker render")

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
                {this.state.currentTheme && <TrackerMenu
                    changeTheme={this.setTheme}
                    availableThemes={this.mapThemes}
                    currentTheme={this.state.currentTheme}
                    toggleMapTypes={this.toggleTerrain}
                    mapType={this.mapType}
                    toggleSnow={this.toggleSnow}

                />}
                {Santa.location.accuracy &&
                    <TrackerStats
                        santaDat={this.state.santaDat}
                        currentTheme={this.state.currentTheme}
                    />}
                {this.state.snow && <Snow />}
            </div>
        )
    }
}

export default Tracker