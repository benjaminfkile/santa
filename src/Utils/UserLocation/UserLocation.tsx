import snackBar from "../snackBar/SnackBar";

let userLocation = {
    coordinates: { lat: null as number | null, lng: null as number | null },
    disable: true,

    getUserLocation: async () => {
        // iOS block: Safari sometimes reports permissions incorrectly
        if (!navigator.geolocation) {
            snackBar({ type: "error", text: "Geolocation is not supported.", timeout: 3000 });
            userLocation.disable = true;
            return;
        }

        // If user explicitly disabled location in app
        if (userLocation.disable) return;

        try {
            // Check permission (iOS 17+ supports this)
            if (navigator.permissions && navigator.permissions.query) {
                try {
                    const perm = await navigator.permissions.query({ name: "geolocation" as PermissionName });

                    if (perm.state === "denied") {
                        userLocation.disable = true;
                        snackBar({ type: "error", text: "Location permission denied.", timeout: 3000 });
                        return;
                    }
                } catch {
                    // Safari may throw just ignore
                }
            }

            navigator.geolocation.getCurrentPosition(
                userLocation.showPosition,
                userLocation.showError,
                {
                    enableHighAccuracy: true,     // REQUIRED for iPhone
                    timeout: 8000,                // iPhone stalls if too long
                    maximumAge: 1000              // Allow small caching
                }
            );
        } catch (err) {
            userLocation.disable = true;
            snackBar({ type: "error", text: "Unable to access location.", timeout: 3000 });
        }
    },

    showPosition: (position: GeolocationPosition) => {
        userLocation.coordinates = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
        };
        userLocation.disable = false;
    },

    showError: (error: GeolocationPositionError) => {
        userLocation.disable = true;

        let msg = "An unknown error occurred";

        switch (error.code) {
            case error.PERMISSION_DENIED:
                msg = "User denied the request for Geolocation.";
                break;
            case error.POSITION_UNAVAILABLE:
                msg = "Location information is unavailable.";
                break;
            case error.TIMEOUT:
                msg = "Location request timed out.";
                break;
        }

        snackBar({ type: "error", text: msg, timeout: 3000 });
    },

    inApp: () => {
        //@ts-ignore
        const ua = navigator.userAgent || navigator.vendor || window.opera;
        return (
            ua.includes("FBAN") ||
            ua.includes("FBAV") ||
            ua.includes("Instagram")
        );
    }
};

export default userLocation;
