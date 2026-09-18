# santa

The WMSFO v2 public site: a static single-page application that reads the live object, the snapshot, and the route from the CDN, listens to one hub channel, and renders the pages an editor composed in the admin panel. It never calls the API for a read.

Read `docs/` before touching anything:

- `docs/site.md`: this repository's technical design, structure, behaviour, and look (section 7.7).
- `docs/DESIGN.md`: the design overview for all of v2 (a copy; the original is in `wmsfo-api/docs`).
- `docs/contracts.md`: the shared contracts every component codes against (a copy; wins on any conflict).
- `docs/design/theme-studio.html`: the theme studio the look was decided in. `docs/wireframes/` holds the earlier structural wireframes, superseded by site.md 7.7.

## Run

```
npm install
npm run dev
```

Vite, React 19, TypeScript. Configuration is `VITE_` environment variables per `docs/site.md` section 3; copy `.env.example` to `.env.local` and fill it in.
