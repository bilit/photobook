# Photobook Creator

A web app to create PDF photobooks from Google Photos albums.

## Features

- **Google Photos integration** — Browse and import albums via OAuth2
- **Photo groups** — Each group maps to one page in the final PDF
- **Priority-based sizing** — Assign priority numbers (1 = largest) to control photo sizes on the page
- **Page templates**:
  - **Focal** — Priority 1 photo is large/dominant, others arranged around it
  - **Grid** — All photos equal size in a grid
- **Live preview** — See how each page will look before exporting
- **Drag-and-drop** — Reorder pages by dragging
- **PDF export** — Server-side generation via Puppeteer

## Setup

### 1. Google OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Google Photos Library API**
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URIs:
   - Development: `http://localhost:3001/auth/google/callback`
   - Production: `https://<your-domain>/auth/google/callback`
5. Copy the Client ID and Client Secret

### 2. Environment variables

```bash
cp backend/.env.example backend/.env
# Edit backend/.env with your credentials
```

### 3. Install dependencies

```bash
npm run install:all
# or manually:
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run (development)

In two terminals:

```bash
# Terminal 1 — backend
npm run dev:backend

# Terminal 2 — frontend
npm run dev:frontend
```

Visit `http://localhost:5173`

## Deployment

### Docker (recommended)

```bash
# Build and run with docker-compose
cp backend/.env.example backend/.env
# Edit backend/.env — set NODE_ENV=production, update BACKEND_URL to your domain

docker compose up --build
```

The app runs on port `3001`. The backend serves the built frontend from the same origin so no separate frontend hosting is needed.

### Manual build

```bash
npm run build          # builds frontend then backend
NODE_ENV=production node backend/dist/index.js
```

In production, `NODE_ENV=production` must be set so the backend serves the frontend static files and sets secure cookies.

## Usage

1. Click **Connect with Google Photos** and authorize
2. Click **Import from Google Photos** to browse your albums
3. Select photos and click **Add X photos as new page**
4. In the page editor:
   - Click the **number badge** on a photo to change its priority (1 = largest)
   - Switch between **Focal** and **Grid** templates
   - See the live **Preview** on the right
5. Drag pages to reorder them
6. Click **Download PDF** to generate and download your photobook
