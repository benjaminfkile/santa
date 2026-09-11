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
  },
  theme: {
    toLight: "Switch to light mode",
    toDark: "Switch to dark mode",
    followSystem: "Follow system",
  },
} as const;
