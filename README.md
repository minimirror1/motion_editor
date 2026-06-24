# Motion Editor

Next.js only motion CSV editor. There is no FastAPI or Python backend.

## Features

- Load motion CSV files where each row is one motor axis.
- Edit axes and nodes on an interactive graph.
- Add, delete, cut, rename, copy, and paste axes.
- Add, remove, shift, drag, copy, and paste nodes.
- Generate partial motion segments with interpolation modes.
- Select partial segments and edit their handles.
- Pan, zoom, fit, focus, undo, and redo graph edits.
- Save edited motion data back to CSV from the browser.

## Run

```bash
npm run dev
```

Open `http://127.0.0.1:3000`.

## Build

```bash
npm run build
```
