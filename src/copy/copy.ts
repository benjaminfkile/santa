// docs/site.md sections 7.1 and 19. The only site-coded strings; everything
// else a visitor reads comes from the content document.

export const copy = {
  loading: {
    initial: "Loading",
    slow: "Still trying to reach the server",
  },
  reload: {
    body: "The site needs to reload to get the latest updates.",
    button: "Reload",
  },
  banners: {
    updatesPaused: "Updates paused, retrying",
    offline: "You appear to be offline",
    preview: "Preview",
  },
  notFound: {
    heading: "Page not found",
    home: "Back to home",
  },
  signIn: {
    hint: "Sign in to continue",
    button: "Sign in",
    signOut: "Sign out",
  },
  errors: {
    generic: "Something went wrong. Please try again.",
    misconfigured: (variable: string) =>
      `Site misconfigured: ${variable} is missing or malformed.`,
  },
  live: {
    live: "Live",
    updating: "Updating",
    updatedAgo: (seconds: number) => `Updated ${seconds}s ago`,
    waitingForFix: "Waiting for the first fix",
    signalLostAgo: (seconds: number) => `No update for ${seconds}s`,
    unavailablePlaceholder: "N/A",
  },
  map: {
    unavailable: "Map unavailable",
    retry: "Retry",
    trackerMenu: "Tracker menu",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
    centerOnSanta: "Center on Santa",
    snow: "Snow",
    poster: {
      zoomIn: "Zoom in",
      zoomOut: "Zoom out",
      fit: "Fit",
    },
  },
  sponsors: {
    open: "Sponsor",
    visit: "Visit website",
    close: "Close",
  },
  cookies: {
    leave: "Leave cookies",
    signInToLeave: "Sign in to leave a cookie",
    title: "Leave cookies for Santa",
    remaining: (remaining: number, limit: number) => `${remaining} of ${limit} left`,
    more: (name: string) => `One more ${name}`,
    fewer: (name: string) => `One fewer ${name}`,
    noteLabel: "Note (optional)",
    noteInvalid: "Please check your note.",
    submit: (n: number) => (n === 1 ? "Leave 1 cookie" : `Leave ${n} cookies`),
    onlyLeft: (n: number) => (n === 1 ? "You only have 1 cookie left. Please pick again." : `You only have ${n} cookies left. Please pick again.`),
    thanks: (n: number) => (n === 1 ? "Thanks for the cookie." : `Thanks for the ${n} cookies.`),
    limitReached: "You have left all your cookies for this year",
    typeGone: "That cookie type is no longer active. Please pick another.",
    tooMany: (secs: number) => `Too many requests. Try again in ${secs}s.`,
    wait: (secs: number) => `Wait ${secs}s`,
    cancel: "Cancel",
    close: "Close",
  },
  theme: {
    picker: "Theme",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
} as const;
