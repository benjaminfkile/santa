let MapKey = {
    // mapUrl: "https://maps.googleapis.com/maps/api/js?v=3.exp&libraries=geometry,drawing,places",
    mapUrl: `https://maps.googleapis.com/maps/api/js?v=3.exp&libraries=geometry,drawing,places&key=${process.env.REACT_APP_MAPS_API_KEY}`,
}
export default MapKey