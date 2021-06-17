let userLocation = {
    coordinates: { lat: null, lng: null },
    getUserLocation: () => {
        navigator.geolocation.getCurrentPosition(userLocation.showPosition);
    },
    showPosition: (position: any) => {
        userLocation.coordinates = { lat: position.coords.latitude, lng: position.coords.longitude }
    },
    inApp: () => {
        //@ts-ignore
        let ua = navigator.userAgent || navigator.vendor || window.opera;
        if ((ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf('Instagram') > -1)) {
            return true
        } else {
            return false
        }
    }
}
export default userLocation