import { Component } from "react";
import Map from "./Map/Map"
import Santa from "../Santa/Santa"
import Standard from './Map/MapStyles/Standard'
import Retro from './Map/MapStyles/Retro'
import Silver from './Map/MapStyles/Silver'
import Dark from './Map/MapStyles/Dark'
import Night from './Map/MapStyles/Night'
import Aubergine from './Map/MapStyles/Aubergine'
import { DropdownButton, Dropdown } from 'react-bootstrap'
import "./Tracker.css"

class Tracker extends Component {

    mapStyles = [Standard, Retro, Silver, Dark, Night, Aubergine]
    map
    marker
    locationInterval
    locationData
    constructor() {
        super();
        this.state = {
            lat: 46.833,
            lng: -114.030,
            style: this.mapStyles[4],
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
        this.map.setOptions({ styles: this.mapStyles[index] })
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
            mapTypeId: 'terrain',
            mapTypeControlOptions: {
                mapTypeIds: ['terrain', 'roadmap', 'hybrid'],
            },
            styles: this.mapStyles[4]
        })
        console.log(this.map)
    }//bump

    render() {

        console.log("render")

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
                <div className="TrackerMenu">
                    <DropdownButton id="dropdown-basic-button" title="Theme">
                        <Dropdown.Item onClick={() => this.setTheme(0)}>Standard</Dropdown.Item>
                        <Dropdown.Item onClick={() => this.setTheme(1)}>Retro</Dropdown.Item>
                        <Dropdown.Item onClick={() => this.setTheme(2)}>Silver</Dropdown.Item>
                        <Dropdown.Item onClick={() => this.setTheme(3)}>Dark</Dropdown.Item>
                        <Dropdown.Item onClick={() => this.setTheme(4)}>Night</Dropdown.Item>
                        <Dropdown.Item onClick={() => this.setTheme(5)}>Aubergine</Dropdown.Item>
                    </DropdownButton>
                </div>
            </div>
        )
    }
}

export default Tracker