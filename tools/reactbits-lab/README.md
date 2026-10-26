# Polyverse React Bits Lab (desktop)

Try [React Bits](https://reactbits.dev) effects against real Poly Oracle / Stroids art in a phone-sized
frame before porting the winners to vanilla JS/WebGL for the app (the app itself has no React).

```sh
npm run lab                       # from the repo root (first time: cd tools/reactbits-lab && npm install)
```

- **Left:** effects by category. **Top:** scene (Polyverse hub, Oracle page, Level warp, Title). Mouse = finger.
- **Right:** props, generated from each component's defaults. Star the ones you like, then **COPY PICKS** and
  paste the JSON into chat to port them.
- `npm run pull` (inside this folder) re-downloads the component sources from the official registry
  (`reactbits.dev/r/<Name>-JS-CSS.json`). Edit the list in `scripts/pull.mjs` to add more.
- Desktop FPS is only a rough guide; phone cost is measured after a winner is ported.
