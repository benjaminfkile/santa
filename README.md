# santa

The WMSFO v2 public site: a static single-page application that reads the live object, the snapshot, and the route from the CDN, listens to one hub channel, and renders the pages an editor composed in the admin panel. It never calls the API for a read.

Read `docs/` before touching anything:

- `docs/site.md`: this repository's technical design. Structure and behaviour; the visual design is a separate track.
- `docs/DESIGN.md`: the design overview for all of v2 (a copy; the original is in `wmsfo-api/docs`).
- `docs/contracts.md`: the shared contracts every component codes against (a copy; wins on any conflict).
- `docs/wireframes/`: the structural wireframes of the site, one artboard per page state.

## Run

```
npm install
npm run dev
```

Vite, React 19, TypeScript. Configuration is `VITE_` environment variables per `docs/site.md` section 3; copy `.env.example` to `.env.local` once it exists.
