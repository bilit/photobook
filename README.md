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
4. Add authorized redirect URI: `http://localhost:3001/auth/google/callback`
5. Copy the Client ID and Client Secret

### 2. Environment variables

```bash
cp .env.example backend/.env
# Edit backend/.env with your credentials
```

### 3. Install dependencies

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 4. Run

In two terminals:

```bash
# Terminal 1 — backend
cd backend && npm run dev

# Terminal 2 — frontend
cd frontend && npm run dev
```

Visit `http://localhost:5173`

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
