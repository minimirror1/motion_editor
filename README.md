# Motion Editor

Next.js only motion CSV editor. There is no FastAPI or Python backend.

## Requirements

- Node.js 20.9.0 or newer
- npm

Python, FastAPI, and any backend server are not required.

## Install

### Ubuntu

Install Node.js and npm:

```bash
sudo apt update
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
```

Check the installed versions:

```bash
node -v
npm -v
```

Install project packages:

```bash
cd /path/to/motion_editor
npm install
```

### Windows

Install Node.js LTS with one of these methods.

Using winget in PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Or install the Node.js LTS installer from `https://nodejs.org`.

After installation, open a new PowerShell window and check:

```powershell
node -v
npm -v
```

Install project packages:

```powershell
cd C:\motion_editor
npm install
```

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
