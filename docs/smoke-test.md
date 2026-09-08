# Runner smoke test

Date: 2026-09-08

Smoke test of the runner environment against the scaffold committed in
`e7c6c26 Bootstrap the WMSFO v2 public site`. The Playwright end-to-end suite
is intentionally not run; it targets the preview site.

## Tool versions

| Tool | Version |
|---|---|
| node | v22.23.2 |
| npm | 10.9.8 |
| dotnet | 10.0.400 |
| gradle | not installed (`gradle: command not found`) — not required by this repo |

## `node -v`

Exit code: 0

```
v22.23.2
```

## `npm ci`

Exit code: 0

```
added 186 packages, and audited 187 packages in 4s

37 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

## `npm run typecheck`

Exit code: 0

```
> santa@0.0.0 typecheck
> tsc -b
```

## `npm run lint`

Exit code: 0

```
> santa@0.0.0 lint
> oxlint
```

## `npm test`

Exit code: 0

```
> santa@0.0.0 test
> vitest run


 RUN  v5.0.0 /workspace


 Test Files  1 passed (1)
      Tests  1 passed (1)
   Start at  01:38:24
   Duration  913ms (environment 74%, setup 12%, tests 7%, transform 4%, import 2%, worker 1%)
```

## `npm run build`

Exit code: 0

```
> santa@0.0.0 build
> tsc -b && vite build

vite v8.2.2 building client environment for production...
transforming...
✓ 20 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                   0.46 kB │ gzip:  0.29 kB
dist/assets/react-CHdo91hT.svg    4.12 kB │ gzip:  2.06 kB
dist/assets/vite-BF8QNONU.svg     8.70 kB │ gzip:  1.60 kB
dist/assets/hero-CLDdwZDr.png    13.05 kB
dist/assets/index-gbgNnWYJ.css    4.27 kB │ gzip:  1.47 kB
dist/assets/index-DOKRX-Lh.js   193.39 kB │ gzip: 60.65 kB │ map: 851.53 kB

✓ built in 121ms
```

## `npm run size`

Exit code: 0

```
> santa@0.0.0 size
> size-limit

  
  dist/assets/index-DOKRX-Lh.js
  Size limit: 130 kB
  Size:       51.6 kB brotlied
  
  dist/assets/index-gbgNnWYJ.css
  Size limit: 25 kB
  Size:       1.26 kB brotlied
```
