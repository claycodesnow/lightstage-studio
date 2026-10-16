# LightStage Studio

Lighting previsualization for real locations. Rebuild a room from listing photos (Peerspace, Airbnb, your own scout), drop in real-world fixtures, modifiers, grip, subjects and props, and see how the actual sun and your lights will behave at any time of day before you arrive.

Think Cinetracer, but starting from the room you've actually booked.

## What it does

**Room from photos**
- Upload any number of listing photos. In the **Photo mapper**, drag four handles to where each wall meets the floor and ceiling. The photo is perspective-corrected onto that wall, so wall colours come through exactly as photographed.
- Box each window or door on the photo. Its real-world size and position are calculated from the wall's perspective. The window is the shared reference that ties the photos together.
- Enter whatever you know, like square footage, ceiling height or exact dimensions. Everything else is estimated.
- Eyedropper wall, floor and ceiling colours from the photos.
- Cut furniture and decor straight out of a photo as movable cards, or use the 3D prop library.
- **AI first pass (optional):** Claude reviews all the photos and proposes dimensions, which wall each photo shows, windows, colours, furniture and orientation clues. You review and correct. Uses your own Anthropic API key, which is stored only in your browser.
- **Photo look ↔ relit** slider: show the walls exactly as they were photographed, or treat the photo as surface colour and relight it with your setup.

**Real sun & daylight**
- Search the address. The app geocodes it, finds the building's outline on OpenStreetMap and lists which way each façade faces. Click the façade your window is on. You can also set it by dragging the compass.
- Sun position uses the NOAA solar algorithm, with the correct local time zone and daylight saving.
- Time-of-day timeline with sunrise and sunset, plus golden hour, blue hour and solar noon shortcuts. You can animate it, follow the real clock live, or jump to a photo's EXIF timestamp.
- Sun intensity and colour temperature change with altitude. Cloud cover and outdoor ground bounce are adjustable. Sky light comes through each window, and sheers, blinds and blackout are supported.

**House lighting: what's already in the rental**
- 25 installed fixture types: recessed cans (2700K–5000K), halogen MR16s, track heads, 2×4 and 2×2 LED troffers, fluorescent troffers and shop lights, flush domes, ceiling-fan kits, pendants, chandeliers, sconces, under-cabinet bars, LED and metal-halide high-bays, smart bulbs.
- Cheap and fluorescent sources carry their real green cast.
- Add an evenly spaced grid of cans or troffers in one click. Switch all house lights on/off or dim them together.
- The AI photo pass also detects the fixtures it can see in the listing photos and places them.
- The meter warns when colour temperatures are mixed (house tungsten vs window daylight vs your kit) and when a fluorescent green spike is significant, with the gel to fix it.

**Lights, modifiers & grip**
- 200+ fixtures from Godox, Aputure, amaran, Nanlite (every PavoTube generation), ARRI, Litepanels, Astera, Quasar, Zhiyun, SmallRig, Elgato, Neewer, Profoto and Flashpoint. Practicals include household bulbs, Edison filaments, Hue, LED strips, neon, monitors, candles, paper lanterns and fluorescent tubes.
- Each light behaves like the real unit:
  - daylight, bi-colour, RGBWW or RGB modes with CCT inside the fixture's real range
  - green/magenta, HSI and RGB control
  - dimmer, zoom on fresnel and zoom fixtures
  - strobe power in stops, converted to an exposure-equivalent intensity at your shutter speed
- 70+ modifiers: softboxes, octas, strips, parabolics, lanterns, shoot-through and bounce umbrellas, beauty dishes, fresnels, projection mounts, barn doors, snoots and grids. Each one changes beam angle, output efficiency and source size, so falloff and shadow softness come out right.
- Lee/Rosco gels.
- Stands: light stands, C-stands, combo stands, booms, low boys, clamps, ceiling rigs.
- Grip: flags, floppies, nets, diffusion frames (216/250/251/grid cloth), butterflies, overheads, V-flats, bounce boards, 5-in-1 reflectors and cookies.
- Output calibration per fixture model: meter your own unit and match it.

**Subjects, props & cameras**
- Unlimited mannequin subjects in 10 skin tones (Monk Skin Tone scale), with height, build and poses including standing, seated interview, guitar, keys and mic.
- Props for music lessons and interviews: guitars, bass, ukulele, violin, cello, upright and grand piano, keyboard, drums, amp, monitors, mics and booms, plus furniture, plants, a backdrop, a gray card and a ColorChecker.
- Camera positions with focal length, sensor size (FF, S35, APS-C, MFT, LF, phone), aspect ratio and frustum. Look through any camera.

**Seeing it & documenting it**
- **Real-time** mode for interactive work, with shadows from the sun and every light.
- **Render** mode: GPU path tracing for physically correct light falloff, soft shadows from the true source size, bounce, and diffusion through frames.
- Orbit, or **free roam** (F, then WASD and drag to look).
- Physical exposure: ISO, shutter and aperture, or auto. White balance and a colour-faithful tone curve.
- Live **incident meter** at the subject's face shows total lux, the recommended f-stop at your ISO and shutter, and each light's contribution and distance.
- **Capture** saves a PNG up to 4K with a data strip: lens, exposure, sun position, each light's modifier, distance, lux, f-stop and CCT, plus an overhead **lighting plot**.
- **Video export:** time-of-day time-lapse (watch the sun patch travel through the room), a camera orbit around the set, or both. Exports MP4 at up to 4K with an optional clock overlay. Rendered frame by frame, so timing is exact however fast your computer is.
- Multiple saved scenes, autosave, undo/redo, and export/import of `.lightstage.json` files to share.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/
```

Pushing to `main` deploys to GitHub Pages through `.github/workflows/deploy.yml`.

## Accuracy notes

- **Fixture photometrics** come from published spec sheets. Manufacturer and retailer figures often disagree, so treat them as starting points. Use *Output calibration* to match your own meter.
- **Window orientation** from building footprints is only as good as OpenStreetMap's data for that address. A phone compass held against the window on a scout is the gold standard.
- **Photo-based walls** are only as accurate as the corner handles you place. Wide shots that show where walls meet the floor and ceiling work best.
- **Real-time mode** approximates bounce light with a room-average estimate. **Render** mode simulates it physically.

## Tech

React 19 + TypeScript + Vite, three.js / react-three-fiber, three-gpu-pathtracer, zustand, IndexedDB for saves. Geocoding by Nominatim and building outlines by Overpass (© OpenStreetMap contributors). Time zones from `@photostructure/tz-lookup`. AI assist uses the Anthropic SDK.
