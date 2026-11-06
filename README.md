# Antonio Jr. V. Nerida - Portfolio Website

Personal developer portfolio for Antonio Jr. V. Nerida (Aeghiknoluvxy), featuring software projects, interactive class and progression previews, and a playable roguelike prototype.

## Tech stack

- React
- JavaScript
- Vite
- CSS

## Run locally

Install Node.js, then run these commands from this repository:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```powershell
npm run build
npm run preview
```

Vite writes the production site to `dist/`.

## Games

The Last Run roguelike and the interactive class/progression previews run in the browser.

The Pebble: Game of Nim project needs its separate Python API. For local development, run that API on `http://127.0.0.1:5000`; Vite proxies `/api` requests to it. When using a separately hosted API, set `VITE_GAME_API_URL` to its base URL when building the site.

## Resume

The Developer **Download my resume** button downloads the current PDF from `public/Antonio-Jr-V-Nerida-Resume.pdf`.
