import { Component } from "react";
import axios from "axios";
import connection from "../Santa/Santa"
import Map from "./Map/Map"
import userLocation from "../UserLocation/UserLocation";
import Standard from './Map/MapThemes/Standard'
import Retro from './Map/MapThemes/Retro'
import Silver from './Map/MapThemes/Silver'
import Dark from './Map/MapThemes/Dark'
import Night from './Map/MapThemes/Night'
import Aubergine from './Map/MapThemes/Aubergine'
import TrackerMenu from "./TrackerMenu/TrackerMenu"
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
    userToSantaCoords = [{}, {}]
    userToSantaFlightPath = null
    projectedRouteCoords = []
    projectedFlightPlath = null
    flightProjectionIndex = -1
    userLocationInterval
    constructor(props) {
        super(props);
        this.state = {
            lat: 46.833,
            lng: -114.030,
            currentTheme: this.mapThemes[4].title,
            snow: false,
            santaDat: {},
            distanceFromUserToSanta: null,
            inApp: true,
            mapCentered: true,
            zoom: 10,
            menuOpen: false,
            test: false
        }
    }

    componentDidMount() {
        if (this.state.test) {
            this.spoofLocation()
        } else {
            connection.on("newMessage", this.setLocation)
            axios.get(`https://wmsfo-dasher.herokuapp.com/api/location-data`)
                .then(res => {
                    let temp = res.data
                    temp.lon = res.data.lng
                    this.setLocation(temp)
                })

        }
        this.userLocationInterval = setInterval(this.listen4UserLocation, 1000)
        this.setState({ inApp: userLocation.inApp() })
    }

    componentWillUnmount() {
        clearInterval(this.userLocationInterval)
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

    setLocation = (input) => {
        if (input) {
            let temp = input
            temp.lng = input.lon
            this.setState({ santaDat: temp })
            this.marker.setPosition({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
            this.userToSantaCoords[0] = { lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) }
            this.autoRecenter()
        }
    }

    listen4UserLocation = () => {
        userLocation.getUserLocation()
        if (userLocation.coordinates.lat
            && userLocation.coordinates.lat !== this.userToSantaCoords[1].lat
            && userLocation.coordinates.lng !== this.userToSantaCoords[1].lng) {
            this.userToSantaCoords[1] = { lat: Number(userLocation.coordinates.lat), lng: Number(userLocation.coordinates.lng) }
        }
        if (this.userToSantaCoords[1].lat && !userLocation.disable) {
            this.drawUserToSantaPoly()
        }
        if (userLocation.disable) {
            this.removePoly()
            this.setState({ distanceFromUserToSanta: false })
        }
    }

    autoRecenter = () => {
        if (this.state.mapCentered) {
            this.map.setCenter({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
        }
    }

    userRecenter = () => {
        this.map.setCenter({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
        this.setState({ mapCentered: true })
    }

    handleZoomClick = (direction) => {
        if (direction === "+") {
            this.map.setZoom(this.state.zoom + 1)
            this.setState({ zoom: this.state.zoom + 1 })
        } else {
            this.map.setZoom(this.state.zoom - 1)
            this.setState({ zoom: this.state.zoom - 1 })
        }
    }

    handleZoomPinch = () => {
        let zoom = this.map.getZoom()
        if (this.state.zoom !== zoom) {
            this.setState({ zoom: zoom })
        }
    }

    handleMapDrag = () => {
        if (this.state.mapCentered) {
            this.setState({ mapCentered: false })
        }
        this.handleZoomPinch()
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

        iconSequence.push(
            {
                icon: circle,
                offset: "100%",
                repeat: "0"
            })

        this.userToSantaFlightPath = new window.google.maps.Polyline({
            path: this.userToSantaCoords,
            color: "#aa253c",
            strokeColor: "#aa253c",
            strokeOpacity: .8,
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
        this.drawRoutePoly()
        const self = this
        window.google.maps.event.addListener(map, 'dragend', function () { self.handleMapDrag() });
    }

    toggleSnow = () => {
        if (this.state.snow) {
            this.setState({ snow: false })
        } else {
            this.setState({ snow: true })
        }
    }

    menuOpen = (isOpen) => {
        this.setState({ menuOpen: isOpen })
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
                                position: { lat: parseFloat(this.state.santaDat.lat), lng: parseFloat(this.state.santaDat.lon) },
                                map: map,
                                label: '',
                                icon: mapIcon
                            });


                        this.marker = marker
                    }
                    }

                />
                {this.state.currentTheme && <TrackerMenu
                    changeTheme={this.setTheme}
                    availableThemes={this.mapThemes}
                    currentTheme={this.state.currentTheme}
                    toggleMapTypes={this.toggleTerrain}
                    mapType={this.mapType}
                    toggleSnow={this.toggleSnow}
                    userCoords={userLocation.coordinates.lat}
                    listenForUserLocation={this.listenForUserLocation}
                    menuOpen={this.menuOpen}
                />}
                {!userLocation.disable && this.state.distanceFromUserToSanta && <div className="DistanceFromUserToSanta" id={"distance-from-user-to-santa-" + this.state.currentTheme.toLowerCase()}>
                    {this.state.distanceFromUserToSanta < 5281 &&
                        <div id="distance-from-user-to-santa-content-wrapper">
                            <img id="santa-hat" src="./res/santa-hat.png" alt=""></img>
                            <p>{this.state.distanceFromUserToSanta.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} ft</p>
                        </div>}
                    {this.state.distanceFromUserToSanta > 5280 &&
                        <div id="distance-from-user-to-santa-content-wrapper">
                            <img id="santa-hat" src="./res/santa-hat.png" alt=""></img>
                            <p> {((this.state.distanceFromUserToSanta / 5280).toFixed(2)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")} mi</p>
                        </div>}
                </div>}
                {!this.state.menuOpen && <div className="FooterControls">
                    {!this.state.mapCentered && <div className="CenterMapBtnWrapper" id={"center-map-btn-wrapper-" + this.state.currentTheme.toLowerCase()}>
                        <div id="center-map-btn"><span className="material-icons" onClick={() => this.userRecenter()}>center_focus_weak</span></div>
                    </div>}
                    {this.state.mapCentered && <div className="MapZoomWrapper" id={"map-zoom-wrapper-" + this.state.currentTheme.toLowerCase()}>
                        <div id="zoom-in-btn" onClick={() => this.handleZoomClick("+")}><span className="material-icons">add_circle_outline</span></div>
                        <div id="zoom-out-btn" onClick={() => this.handleZoomClick("-")}><span className="material-icons">remove_circle_outline</span></div>
                    </div>}
                </div>}
                {this.state.snow && <Snow />}
            </div>
        )
    }
}

export default Tracker