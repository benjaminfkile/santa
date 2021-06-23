import { Component } from "react";
import Map from "./Map/Map"
import Santa from "../Santa/Santa"
import userLocation from "../UserLocation/UserLocation";
import Standard from './Map/MapThemes/Standard'
import Retro from './Map/MapThemes/Retro'
import Silver from './Map/MapThemes/Silver'
import Dark from './Map/MapThemes/Dark'
import Night from './Map/MapThemes/Night'
import Aubergine from './Map/MapThemes/Aubergine'
import TrackerMenu from "./TrackerMenu/TrackerMenu"
import TrackerStats from "./TrackerStats/TrackerStats"
import Snow from "../Snow/Snow"
import projectedRoute from "../ProjectedRoute/ProjectedRoute";
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
    locationUpdateInterval
    userToSantaCoords = [{}, {}]
    userToSantaFlightPath = null
    projectedRouteCoords = []
    projectedFlightPlath = null
    flightProjectionIndex = -1
    constructor() {
        super();
        this.state = {
            lat: 46.833,
            lng: -114.030,
            currentTheme: this.mapThemes[4].title,
            snow: false,
            santaDat: {},
            distanceFromUserToSanta: null,
            inApp: true,
            centerMap: false,
            test: true
        }
    }

    componentDidMount() {
        this.setState({ inApp: userLocation.inApp() })
        if (!this.state.test) {
            Santa.getSantaData()
            this.locationUpdateInterval = setInterval(this.setLocation, 500)
        } else {
            this.locationUpdateInterval = setInterval(this.spoofLocation, 1000)
        }
    }

    componentWillUnmount() {
        clearInterval(this.locationUpdateInterval)
    }

    spoofLocation = () => {
        if (this.flightProjectionIndex < projectedRoute.length - 1) {
            this.flightProjectionIndex += 1
        } else {
            this.flightProjectionIndex = 0
        }

        let temp = {
            accuracy: projectedRoute[this.flightProjectionIndex].Accuracy,
            alt: projectedRoute[this.flightProjectionIndex].Elevation,
            bear: projectedRoute[this.flightProjectionIndex].Bearing,
            lat: projectedRoute[this.flightProjectionIndex].Lat,
            lng: projectedRoute[this.flightProjectionIndex].Lon,
            speed: projectedRoute[this.flightProjectionIndex].Speed,
            throttle: 60000,
        }

        this.setState({ santaDat: temp })
        this.marker.setPosition({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
        this.userToSantaCoords[0] = { lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) }
        this.setLocation()
    }

    setLocation = () => {
        const santaDat = Santa.location
        if ((JSON.stringify(santaDat) !== JSON.stringify(this.state.santaDat)) && santaDat.lat && !this.state.test) {
            this.setState({ santaDat: santaDat })
            this.marker.setPosition({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
            this.userToSantaCoords[0] = { lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) }
        }
        if (userLocation.coordinates.lat) {
            this.userToSantaCoords[1] = { lat: Number(userLocation.coordinates.lat), lng: Number(userLocation.coordinates.lng) }
        }
        if (!this.state.inApp && userLocation.coordinates.lat) {
            userLocation.getUserLocation()
        }
        if (this.userToSantaCoords[1].lat) {
            this.drawUserToSantaPoly()
        }
        if (!userLocation.coordinates.lat) {
            this.removePoly()
        }
        if (this.projectedRouteCoords.length === 0) {
            this.drawRoutePoly()
        }
        this.handleMapCenter()
    }

    handleMapCenter = () => {
        if (this.state.centerMap) {
            this.map.setCenter({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
        }
    }

    drawRoutePoly = () => {
        for (let i = 0; i < projectedRoute.length; i++) {
            this.projectedRouteCoords.push({ lat: Number(projectedRoute[i].Lat), lng: Number(projectedRoute[i].Lon) })
        }
        this.projectedFlightPlath = new window.google.maps.Polyline({
            path: this.projectedRouteCoords,
            color: "#5d5d5d",
            strokeColor: "#5d5d5d",
            strokeOpacity: 1,
            strokeWeight: 1.5,

        })
        this.projectedFlightPlath.setMap(this.map);

    }

    drawUserToSantaPoly = () => {
        this.removePoly()
        let iconSequence = [];
        let circle = {
            "path": "M -2,0 C -1.947018,-2.2209709 1.9520943,-2.1262691 2,0.00422057 2.0378955,1.3546185 1.5682108,2.0631345 1.4372396e-8,2.0560929 -1.7155482,2.0446854 -1.9145886,1.0142836 -2,0.06735507 Z",
            "fillColor": "#aa253c",
            "fillOpacity": 0.8,
            "strokeColor": "#aa253c",
            "strokeWeight": 20,
            "scale": 1
        }

        iconSequence.push({ icon: circle, offset: "100%", repeat: "0" })

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

        // console.log("tracker render")
        // console.log(this.state)

        return (

            <div className="TrackerContainer">
                <Map
                    id="Map"
                    onMapLoad={map => {
                        this.setMapOptions(map)
                        let mapIcon = {
                            url: './res/santa-icon.png',
                            scaledSize: new window.google.maps.Size(50, 50),
                            origin: new window.google.maps.Point(0, 0),
                            anchor: new window.google.maps.Point(22, 28)

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
                    userCoords={userLocation.coordinates.lat}

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