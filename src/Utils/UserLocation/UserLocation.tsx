let userLocation = {
    coordinates: { lat: null, lng: null },
    disable: true,
    userDenied: false,
    getUserLocation: () => {

        if (!userLocation.disable) {
            navigator.geolocation.getCurrentPosition(userLocation.showPosition, userLocation.errorCallback,
                {
                    maximumAge: Infinity,
                    timeout: 0
                })
        }
    },
    errorCallback: (err: any) => {
        if (err.code === err.PERMISSION_DENIED) {
            userLocation.disable = true
            userLocation.userDenied = true
        }
    },
    showPosition: (position: any) => {
        userLocation.coordinates = { lat: position.coords.latitude, lng: position.coords.longitude }
    },
    inApp: () => {
        //@ts-ignore
        let ua = navigator.userAgent || navigator.vendor || window.opera
        if ((ua.indexOf("FBAN") > -1) || (ua.indexOf("FBAV") > -1) || (ua.indexOf('Instagram') > -1)) {
            return true
        } else {
            return false
        }
    }
}
export default userLocation