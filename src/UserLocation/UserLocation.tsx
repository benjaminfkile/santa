let userLocation = {
    coordinates: {},
    getUserLocation: () => {
        navigator.geolocation.getCurrentPosition(userLocation.showPosition);
    },
    showPosition: (position: any) => {
        userLocation.coordinates = { lat: position.coords.latitude, lng: position.coords.longitude }
    }
}
export default userLocation