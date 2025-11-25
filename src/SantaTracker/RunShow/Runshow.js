import { Component } from "react";
import Map from "./Map";
import userLocation from "../../Utils/UserLocation/UserLocation";
import Standard from "./MapThemes/Standard";
import Retro from "./MapThemes/Retro";
import Silver from "./MapThemes/Silver";
import Dark from "./MapThemes/Dark";
import Night from "./MapThemes/Night";
import Aubergine from "./MapThemes/Aubergine";
import TrackerMenu from "./Menu/Menu";
import Snow from "../../Utils/Snow/Snow";
import SponsorCarousel from "../../Utils/SponsorCarousel/SponsorCarousel";
import "./Runshow.css";
class Tracker extends Component {
  mapThemes = [
    {
      mapTheme: Standard,
      title: "Standard",
      nickName: "Standard",
      routeColor: "#2962ff",
      arrowColor: "#000000",
      routeOpacity: 1,
    },
    {
      mapTheme: Retro,
      title: "Retro",
      nickName: "Retro",
      routeColor: "#000000ff",
      arrowColor: "#000000ff",
      routeOpacity: 1,
    },
    {
      mapTheme: Silver,
      title: "Silver",
      nickName: "Blizzard",
      routeColor: "#0099ff",
      arrowColor: "#0099ff",
      routeOpacity: 1,
    },
    {
      mapTheme: Dark,
      title: "Dark",
      nickName: "Dark",
      routeColor: "#ffffff7c",
      arrowColor: "#ffffff7c",
      routeOpacity: 1,
    },
    {
      mapTheme: Night,
      title: "Night",
      nickName: "Night",
      routeColor: "#00eaff7d",
      arrowColor: "#ffffff81",
      routeOpacity: 1,
    },
    {
      mapTheme: Aubergine,
      title: "Aubergine",
      nickName: "Nebula",
      routeColor: "#00C2C7",
      arrowColor: "#ffffff7c",
      routeOpacity: .5,
    },
  ];
  map;
  mapType = "terrain";
  marker = null;
  userMarker = null;
  pulseIcon = null;
  userToSantaCoords = [{}, {}];
  userToSantaFlightPath = null;
  updateinterval = 500;
  routePolyline = null;

  state = {
    lat: 46.833,
    lng: -114.03,
    currentTheme: this.mapThemes[4].title,
    snow: false,
    santaDat: {},
    DistanceFromUserToSanta: null,
    mapCentered: true,
    zoom: 10,
    menuOpen: false,
    test: true,
    donate: false,
    route2024: [],
    showHistory: false,
  };

  componentDidMount() {
    setInterval(this.getUserLocation, this.updateinterval);
  }

  componentWillUnmount() {
    clearInterval(this.updateinterval);
    this.updateinterval = null;
    this.wakeLock = false;
    if (this.userMarker) {
      this.userMarker.setMap(null);
      this.userMarker = null;
    }
    clearInterval(this.userBlinkInterval);

    this.setState({});
  }

  getUserLocation = () => {
    if (
      userLocation.coordinates.lat &&
      this.props.santaDat.lat
      // && userLocation.coordinates.lat !== this.userToSantaCoords[1].lat
      // && userLocation.coordinates.lng !== this.userToSantaCoords[1].lng
    ) {
      this.userToSantaCoords[0] = {
        lat: Number(this.props.santaDat.lat),
        lng: Number(this.props.santaDat.lng),
      };
      this.userToSantaCoords[1] = {
        lat: Number(userLocation.coordinates.lat),
        lng: Number(userLocation.coordinates.lng),
      };

      //--------------------------------------
      // THEMED USER MARKER (blinking dot)
      //--------------------------------------
      if (!userLocation.disable && userLocation.coordinates.lat) {
        const theme = this.mapThemes.find(
          (t) => t.title === this.state.currentTheme
        );

        // Update icon color based on theme
        this.pulseIcon = {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: theme?.routeColor || "#4aa3ff",
          fillOpacity: 1,
          strokeWeight: 0,
        };

        if (this.userMarker) {
          this.userMarker.setIcon(this.pulseIcon);
        }

        const pos = {
          lat: Number(userLocation.coordinates.lat),
          lng: Number(userLocation.coordinates.lng),
        };

        // Create or update user marker
        if (!this.userMarker) {
          this.userMarker = new window.google.maps.Marker({
            position: pos,
            map: this.map,
            icon: this.pulseIcon,
            optimized: false, // required for blinking animations
          });

          // Blinking effect
          let visible = true;
          this.userBlinkInterval = setInterval(() => {
            if (this.userMarker) {
              this.userMarker.setVisible(visible);
              visible = !visible;
            }
          }, 600);
        } else {
          this.userMarker.setPosition(pos);
        }
      }

      // Remove marker if user disables location
      if (userLocation.disable && this.userMarker) {
        this.userMarker.setMap(null);
        this.userMarker = null;
        clearInterval(this.userBlinkInterval);
      }
    }
    if (this.userToSantaCoords[1].lat && !userLocation.disable) {
      this.drawUserToSantaPoly();
    }
    if (userLocation.disable) {
      this.removePoly();
      this.setState({ DistanceFromUserToSanta: false });
    }
  };

  autoRecenter = () => {
    if (this.state.mapCentered && this.props.santaDat) {
      this.map.setCenter({
        lat: Number(this.props.santaDat.lat),
        lng: Number(this.props.santaDat.lng),
      });
    }
  };

  userRecenter = () => {
    this.map.setCenter({
      lat: Number(this.props.santaDat.lat),
      lng: Number(this.props.santaDat.lng),
    });
    this.setState({ mapCentered: true });
  };

  handleZoomClick = (direction) => {
    if (direction === "+") {
      this.map.setZoom(this.state.zoom + 1);
      this.setState({ zoom: this.state.zoom + 1 });
    } else {
      this.map.setZoom(this.state.zoom - 1);
      this.setState({ zoom: this.state.zoom - 1 });
    }
  };

  handleZoomPinch = () => {
    let zoom = this.map.getZoom();
    if (this.state.zoom !== zoom) {
      this.setState({ zoom: zoom });
    }
  };

  handleMapDrag = () => {
    if (this.state.mapCentered) {
      this.setState({ mapCentered: false });
    }
    this.handleZoomPinch();
  };

  drawUserToSantaPoly = () => {
    this.removePoly();

    const theme = this.mapThemes.find(
      (t) => t.title === this.state.currentTheme
    );
    const color = theme?.routeColor || "#28a745";

    // Create "dot" symbol
    const dotSymbol = {
      path: window.google.maps.SymbolPath.CIRCLE,
      scale: 1.5,
      strokeColor: color,
      strokeOpacity: 1,
      fillColor: color,
      fillOpacity: 1,
    };

    this.userToSantaFlightPath = new window.google.maps.Polyline({
      path: this.userToSantaCoords,
      strokeOpacity: 0, // hide solid line
      icons: [
        {
          icon: dotSymbol,
          offset: "0",
          repeat: "10px", // distance between dots
        },
      ],
    });

    let lengthInMeters = window.google.maps.geometry.spherical.computeLength(
      this.userToSantaFlightPath.getPath()
    );

    this.setState({
      DistanceFromUserToSanta: Math.floor(lengthInMeters * 3.28084),
    });

    this.userToSantaFlightPath.setMap(this.map);
  };

  removePoly = () => {
    if (this.userToSantaFlightPath) {
      this.userToSantaFlightPath.setMap(null);
    }
  };

  setTheme = (index) => {
    // 1. Apply the map style immediately
    this.map.setOptions({ styles: this.mapThemes[index].mapTheme });

    // 2. Update state, then redraw route + update user marker color
    this.setState({ currentTheme: this.mapThemes[index].title }, () => {
      // Redraw flight history arrows with new colors
      this.drawRoutePolyline();

      // -------------- UPDATE USER MARKER COLOR --------------
      if (this.userMarker) {
        const theme = this.mapThemes[index];

        // Rebuild the pulse icon using new theme colors
        this.pulseIcon = {
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: theme.routeColor, // main color for blinking dot
          fillOpacity: 1,
          strokeWeight: 0,
        };

        // Apply new icon to the existing marker
        this.userMarker.setIcon(this.pulseIcon);
      }
      // -------------------------------------------------------
    });
  };

  toggleTerrain = () => {
    if (this.mapType === "terrain") {
      this.mapType = "roadmap";
      this.map.setOptions({ mapTypeId: "roadmap" });
    } else {
      this.mapType = "terrain";
      this.map.setOptions({ mapTypeId: "terrain" });
    }
  };

  setMapOptions = (map) => {
    this.map = map;
    this.map.setOptions({
      center: { lat: this.state.lat, lng: this.state.lng },
      zoom: 10,
      mapTypeControl: false,
      zoomControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      disableDefaultUI: true,
      gestureHandling: "greedy",
      mapTypeId: "terrain",
      mapTypeControlOptions: {
        mapTypeIds: ["terrain", "roadmap", "hybrid"],
      },
      styles: this.mapThemes[4].mapTheme,
    });
    const self = this;
    window.google.maps.event.addListener(map, "dragstart", function () {
      self.handleMapDrag();
    });
  };

  toggleSnow = () => {
    if (this.state.snow) {
      this.setState({ snow: false });
    } else {
      this.setState({ snow: true });
    }
  };

  menuOpen = (isOpen) => {
    this.setState({ menuOpen: isOpen });
  };

  toggleCompass = () => {
    if (this.state.compass) {
      this.setState({ compass: false });
    } else {
      this.setState({ compass: true });
    }
  };

  fetchRoute = async () => {
    try {
      const res = await fetch(
        `${process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL}/api/flight-history/2024`
      );
      const json = await res.json();

      if (!Array.isArray(json)) return;

      const coords = json.map((p) => ({
        lat: Number(p.lat),
        lng: Number(p.lon),
      }));

      this.setState({ route2024: coords }, () => {
        this.drawRoutePolyline();
      });
    } catch (err) {
      console.error("Failed to load route:", err);
    }
  };

  getArrowScaleForZoom(zoom) {
    if (zoom >= 15) return 6;
    if (zoom >= 13) return 5;
    if (zoom >= 11) return 4;
    if (zoom >= 9) return 3;
    return 2;
  }

  getArrowStepForZoom(zoom) {
    if (zoom >= 15) return 20; // arrows every 20 points
    if (zoom >= 13) return 40;
    if (zoom >= 11) return 80;
    if (zoom >= 9) return 150;
    return 250; // far out: sparse arrows
  }

  getCurrentRouteColor = () => {
    const theme = this.mapThemes.find(
      (t) => t.title === this.state.currentTheme
    );
    return theme?.routeColor || "#FF0000";
  };

  drawRoutePolyline = () => {
    if (!this.map) return;

    // hide route if toggled off
    if (!this.state.showHistory) {
      if (this.routePolyline) this.routePolyline.setMap(null);
      if (this.arrowPolyline) this.arrowPolyline.setMap(null);
      return;
    }

    if (this.state.route2024.length === 0) return;

    const path = this.state.route2024;

    // Remove old polylines
    if (this.routePolyline) this.routePolyline.setMap(null);
    if (this.arrowPolyline) this.arrowPolyline.setMap(null);

    const zoom = this.map.getZoom();
    const STEP = this.getArrowStepForZoom(zoom);

    const theme = this.mapThemes.find(
      (t) => t.title === this.state.currentTheme
    );

    const routeColor = theme?.routeColor || "#FF0000";
    const arrowColor = theme?.arrowColor || "#FFFFFF";
    const routeOpacity = theme?.routeOpacity || 1

    // ---- BUILD ARROWS ----
    const arrowSymbol = {
      path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: this.getArrowScaleForZoom(zoom),
      strokeColor: arrowColor,
      strokeOpacity: 1,
      fillColor: arrowColor,
      fillOpacity: 1,
    };

    const icons = [];
    for (let i = STEP; i < path.length; i += STEP) {
      icons.push({
        icon: arrowSymbol,
        offset: `${(i / path.length) * 100}%`,
      });
    }

    const cleanedPath = [];
    for (let i = 0; i < path.length; i++) {
      if (i % STEP === 0) continue;
      cleanedPath.push(path[i]);
    }

    this.routePolyline = new window.google.maps.Polyline({
      path: cleanedPath,
      strokeColor: routeColor,
      strokeOpacity: routeOpacity,
      strokeWeight: 2,
      geodesic: true,
    });

    this.routePolyline.setMap(this.map);

    this.arrowPolyline = new window.google.maps.Polyline({
      path,
      strokeColor: "#00000000",
      strokeOpacity: 0,
      strokeWeight: 0,
      icons,
    });

    this.arrowPolyline.setMap(this.map);
  };

  toggleHistory = () => {
    this.setState({ showHistory: !this.state.showHistory }, () =>
      this.drawRoutePolyline()
    );
  };

  render() {
    if (this.marker) {
      this.marker.setPosition({
        lat: Number(this.props.santaDat.lat),
        lng: Number(this.props.santaDat.lng),
      });
      this.autoRecenter();
    }

    return (
      <div className="TrackerContainer">
        {!this.state.loading && (
          <div>
            <Map
              id="Map"
              onMapLoad={(map) => {
                this.setMapOptions(map);

                window.google.maps.event.addListener(
                  map,
                  "zoom_changed",
                  () => {
                    this.drawRoutePolyline(); // redraw arrows with new scaling
                  }
                );

                // Wait for Google Maps projection to be ready
                window.google.maps.event.addListenerOnce(map, "idle", () => {
                  this.fetchRoute();
                });

                let mapIcon = {
                  url: "./res/santa-icon.png",
                  scaledSize: new window.google.maps.Size(65, 65),
                  origin: new window.google.maps.Point(0, 0),
                  anchor: new window.google.maps.Point(35, 58),
                };

                let marker = new window.google.maps.Marker({
                  position: {
                    lat: parseFloat(this.props.santaDat.lat),
                    lng: parseFloat(this.props.santaDat.lng),
                  },
                  map: map,
                  label: "",
                  icon: mapIcon,
                });

                this.marker = marker;
              }}
            />
            {this.state.currentTheme && (
              <TrackerMenu
                changeTheme={this.setTheme}
                availableThemes={this.mapThemes}
                currentTheme={this.state.currentTheme}
                toggleMapTypes={this.toggleTerrain}
                mapType={this.mapType}
                toggleSnow={this.toggleSnow}
                toggleHistory={this.toggleHistory}
                menuOpen={this.menuOpen}
                santaDat={this.props.santaDat}
                getUserLocation={this.getUserLocation}
                DistanceFromUserToSanta={this.state.DistanceFromUserToSanta}
                toggleCompass={this.toggleCompass}
              />
            )}
            <div className="TopLeftInfoWrapper">
              {!userLocation.disable &&
                this.state.DistanceFromUserToSanta &&
                !this.state.menuOpen && (
                  <div
                    className="DistanceFromUserToSanta"
                    id={
                      "distance-from-user-to-santa-" +
                      this.state.currentTheme.toLowerCase()
                    }
                  >
                    {this.state.DistanceFromUserToSanta < 5281 && (
                      <div id="distance-from-user-to-santa-content-wrapper">
                        <span className="material-icons">
                          person_pin_circle
                        </span>
                        {/* <img id="santa-hat" src="./res/santa-hat.png" alt=""></img> */}
                        <p>
                          {this.state.DistanceFromUserToSanta.toString().replace(
                            /\B(?=(\d{3})+(?!\d))/g,
                            ","
                          )}{" "}
                          ft
                        </p>
                      </div>
                    )}
                    {this.state.DistanceFromUserToSanta > 5280 && (
                      <div id="distance-from-user-to-santa-content-wrapper">
                        {/* <img id="santa-hat" src="./res/santa-hat.png" alt=""></img> */}
                        <span className="material-icons">
                          person_pin_circle
                        </span>
                        <p>
                          {" "}
                          {(this.state.DistanceFromUserToSanta / 5280)
                            .toFixed(2)
                            .toString()
                            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}{" "}
                          mi
                        </p>
                      </div>
                    )}
                  </div>
                )}
            </div>

            {!this.state.menuOpen && (
              <div className="FooterControls">
                {!this.state.mapCentered && (
                  <div
                    className="CenterMapBtnWrapper"
                    id={
                      "center-map-btn-wrapper-" +
                      this.state.currentTheme.toLowerCase()
                    }
                  >
                    <div id="center-map-btn">
                      <span
                        className="material-icons"
                        onClick={() => this.userRecenter()}
                      >
                        center_focus_weak
                      </span>
                    </div>
                  </div>
                )}
                {this.state.mapCentered && (
                  <div
                    className="MapZoomWrapper"
                    id={
                      "map-zoom-wrapper-" +
                      this.state.currentTheme.toLowerCase()
                    }
                  >
                    <div
                      id="zoom-in-btn"
                      onClick={() => this.handleZoomClick("+")}
                    >
                      <span className="material-icons">add</span>
                    </div>
                    <div
                      id="zoom-out-btn"
                      onClick={() => this.handleZoomClick("-")}
                    >
                      <span className="material-icons">remove</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {this.state.snow && <Snow />}
        <SponsorCarousel
          sponsors={this.props.sponsors}
          theme={this.state.currentTheme}
        />
      </div>
    );
  }
}

export default Tracker;
