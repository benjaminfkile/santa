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
    userToSantaCoords = [{}, {}]
    userToSantaFlightPath = null
    constructor() {
        super();
        this.state = {
            lat: 46.833,
            lng: -114.030,
            currentTheme: this.mapThemes[4].title,
            snow: false,
            santaDat: {},
            distanceFromUserToSanta: null
        }
    }

    componentDidMount() {
        Santa.getSantaData()
        this.updateInterval = setInterval(this.setLocation, 500)
    }

    componentWillUnmount() {
        clearInterval(this.updateInterval)
    }

    setLocation = () => {
        const santaDat = Santa.location
        if ((JSON.stringify(santaDat) !== JSON.stringify(this.state.santaDat)) && santaDat.lat) {
            this.setState({ santaDat: santaDat })
            this.map.setCenter({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
            this.marker.setPosition({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
            this.userToSantaCoords[0] = { lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) }
            this.userToSantaCoords[1] = { lat: Number(46.910480), lng: Number(-114.052400) }
            this.drawPoly()
        }
    }

    drawPoly = () => {
        this.removePoly()
        let iconSequence = [];
        let circle1 = {
            "path": "M -2,0 C -1.947018,-2.2209709 1.9520943,-2.1262691 2,0.00422057 2.0378955,1.3546185 1.5682108,2.0631345 1.4372396e-8,2.0560929 -1.7155482,2.0446854 -1.9145886,1.0142836 -2,0.06735507 Z",
            "fillColor": "#aa253c",
            "fillOpacity": 0.8,
            "strokeColor": "#aa253c",
            "strokeWeight": 20,
            "scale": 1
        }

        // let circle2 = {
        //     "path": "M -2,0 C -1.947018,-2.2209709 1.9520943,-2.1262691 2,0.00422057 2.0378955,1.3546185 1.5682108,2.0631345 1.4372396e-8,2.0560929 -1.7155482,2.0446854 -1.9145886,1.0142836 -2,0.06735507 Z",
        //     "fillColor": "#000000",
        //     "fillOpacity": .5,
        //     "strokeColor": "#000000",
        //     "strokeWeight": 0,
        //     "scale": 12
        // }

        iconSequence.push({ icon: circle1, offset: "100%", repeat: "0" })
        // iconSequence.push({ icon: circle2, offset: "0%", repeat: "0" })

        this.userToSantaFlightPath = new window.google.maps.Polyline({
            path: this.userToSantaCoords,
            color: "#aa253c",
            strokeColor: "#aa253c",
            strokeOpacity: 1,
            strokeWeight: 1.5,
            icons: iconSequence

        })

        let lengthInMeters = window.google.maps.geometry.spherical.computeLength(this.userToSantaFlightPath.getPath());
        this.setState({ distanceFromUserToSanta: Math.floor(lengthInMeters * 3.28084) })

        this.userToSantaFlightPath.setMap(this.map);
    }

    removePoly = () => {
        if (this.userToSantaFlightPath) {
            this.userToSantaFlightPath.setMap(null);
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
        console.log(this.state)

        return (

            <div className="TrackerContainer">
                <Map
                    id="Map"
                    onMapLoad={map => {
                        this.setMapOptions(map)

                        let mapIcon = {
                            url: './res/santa-icon.png' ,
                            scaledSize: new window.google.maps.Size(50, 50), // scaled size
                            origin: new window.google.maps.Point(0,0), // origin
                            anchor: new window.google.maps.Point(22, 28) // anchor

                        }
                        let marker = new window.google.maps.Marker(
                            {
                                position: { lat: parseFloat(this.state.santaDat.lat), lng: parseFloat(this.state.santaDat.lng) },
                                map: map,
                                label: '',
                                icon: mapIcon
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
                        distanceFromUserToSanta={this.state.distanceFromUserToSanta}
                    />}
                {this.state.snow && <Snow />}
            </div>
        )
    }
}

export default Tracker