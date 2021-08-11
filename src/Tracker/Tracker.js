import { Component } from "react";
import axios from "axios";
import NoSleep from 'nosleep.js';
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
            { mapTheme: Standard, title: "Standard", nickName: "Standard" },
            { mapTheme: Retro, title: "Retro", nickName: "Retro" },
            { mapTheme: Silver, title: "Silver", nickName: "Blizzard" },
            { mapTheme: Dark, title: "Dark", nickName: "Blackout" },
            { mapTheme: Night, title: "Night", nickName: "Night" },
            { mapTheme: Aubergine, title: "Aubergine", nickName: "Indigo" }
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
    getSantaInterval
    updateInterval = 5000
    wakeLock
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
            test: true
        }
    }

    componentDidMount() {
        this.userLocationInterval = setInterval(this.listen4UserLocation, 1000)
        this.getSantaInterval = setInterval(this.getSanta, this.updateInterval)
        this.getSanta()
        this.setState({ inApp: userLocation.inApp() })
        this.keepAwake()
    }

    componentWillUnmount() {
        clearInterval(this.userLocationInterval)
        clearInterval(this.getSantaInterval)
        this.wakeLock = false
    }

    getSanta = () => {
        axios.get(`https://wmsfo-location-data.herokuapp.com/api/location-data`)
            // axios.get(`http://localhost:8000/api/location-data`)
            .then(res => {
                // this.getSanta(res.data)
                // console.log(res.data)
                if (res.data) {
                    this.setState({ santaDat: res.data })
                    this.marker.setPosition({ lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) })
                    this.userToSantaCoords[0] = { lat: Number(this.state.santaDat.lat), lng: Number(this.state.santaDat.lng) }
                    this.autoRecenter()
                }
                if (parseInt(res.data.throttle) !== this.updateInterval) {
                    clearInterval(this.getSantaInterval)
                    this.updateInterval = parseInt(res.data.throttle)
                    this.getSantaInterval = setInterval(this.getSanta, this.updateInterval)
                }
                console.log("Online: " + parseInt(res.data.rps) * parseInt(res.data.dynos))
            })

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

    keepAwake = () => {
        if (!this.wakeLock) {
            let noSleep = new NoSleep();
            noSleep.enable()
        }
    }

    drawRoutePoly = () => {
        let color = ""
        let colorDex = -1
        for (let i = 0; i < projectedRoute.length; i++) {
            colorDex++
            if (colorDex === 0) {
                color = "#cc2626"
            }
            if (colorDex === 1) {
                color = "#9acd32"
            }
            if (colorDex === 2) {
                color = "#ffffff"
                colorDex = -1
            }
            if (i < projectedRoute.length - 1) {
                let coords = []
                coords.push({ lat: Number(projectedRoute[i].Lat), lng: Number(projectedRoute[i].Lon) })
                coords.push({ lat: Number(projectedRoute[i + 1].Lat), lng: Number(projectedRoute[i + 1].Lon) })
                coords = new window.google.maps.Polyline({
                    path: coords,
                    color: color,
                    strokeColor: color,
                    strokeOpacity: .7,
                    strokeWeight: 1,
                })
                coords.setMap(this.map)
            }
        }
    }

    drawUserToSantaPoly = () => {
        this.removePoly()
        let iconSequence = [];
        let circle = {
            "path": "M -2,0 C -1.947018,-2.2209709 1.9520943,-2.1262691 2,0.00422057 2.0378955,1.3546185 1.5682108,2.0631345 1.4372396e-8,2.0560929 -1.7155482,2.0446854 -1.9145886,1.0142836 -2,0.06735507 Z",
            "fillColor": "#cc2626",
            "fillOpacity": 0.7,
            "strokeColor": "#cc2626",
            "strokeWeight": 13,
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
            color: "#cc2626",
            strokeColor: "#cc2626",
            strokeOpacity: 0.7,
            strokeWeight: 1,
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
                            scaledSize: new window.google.maps.Size(60, 60),
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
                    menuOpen={this.menuOpen}
                    santaDat={this.state.santaDat}
                />}
                {!userLocation.disable && this.state.distanceFromUserToSanta && !this.state.menuOpen && <div className="DistanceFromUserToSanta" id={"distance-from-user-to-santa-" + this.state.currentTheme.toLowerCase()}>
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
                        <div id="zoom-in-btn" onClick={() => this.handleZoomClick("+")}><span className="material-icons">add</span></div>
                        <div id="zoom-out-btn" onClick={() => this.handleZoomClick("-")}><span className="material-icons">remove</span></div>
                    </div>}
                </div>}
                {this.state.snow && <Snow />}
            </div>
        )
    }
}

export default Tracker