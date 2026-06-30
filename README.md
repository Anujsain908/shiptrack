# ShipTrack 🚚 (Customer Transport Tracker)

ShipTrack is a full-stack web application for tracking customer orders, transport companies, coverage cities, and shipping statuses.

---

## Features

- **Dynamic Stats Board**: Auto-updates Total Customers, Unique Transport Companies, and Cities Covered.
- **Instant Search Filters**: Instantly filters customer details by Name, Phone Number, City, or Transport Company.
- **Transport Company Filter**: Dropdown menu to filter logs by a specific shipping provider.
- **Autocomplete Input Suggestions**: Autocompletes city and transport company names based on existing entries.
- **RESTful CRUD Operations**: Create, Read, Update, and Delete entries in real-time.
- **CSV Export Engine**: Instantly generates and downloads an RFC 4180-compliant CSV report of all tracking records.
- **Toast Notifications**: Smooth, color-coded status alerts.
- **Responsive Layout**: Designed with fluid CSS Grid and Flexbox for mobile, tablet, and desktop views.
- **Premium Styling**: Designed with the Inter typography scale, smooth animations, glassmorphic cards, and custom CSS variables.

---

## Tech Stack

- **Frontend**: Semantic HTML5, Vanilla CSS, Vanilla JavaScript.
- **Backend**: Node.js, Express, MongoDB (via Mongoose ODM), CORS.

---

## Project Structure

```
shiptrack/
├── README.md
├── frontend/
│   ├── index.html
│   ├── styles.css
│   └── app.js
└── backend/
    ├── package.json
    ├── server.js
    ├── models/
    │   └── Customer.js
    ├── .env
    └── .env.example
```

---

## Getting Started (Local Development)

### Prerequisites

- [Node.js](https://nodejs.org/) (v16.0 or higher recommended)
- [MongoDB](https://www.mongodb.com/) (either running locally or a MongoDB Atlas URI connection string)

### 1. Set Up the Database

Ensure MongoDB is running locally on the default port:
```bash
mongodb://localhost:27017
```
Or set up a free database instance on [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).

### 2. Set Up the Backend

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create your local environment file:
   ```bash
   cp .env.example .env
   ```
3. Open `.env` and set your configuration parameters:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://127.0.0.1:27017/shiptrack
   ```
4. Install backend dependencies:
   ```bash
   npm install
   ```
5. Launch the backend API:
   - For standard run:
     ```bash
     npm start
     ```
   - For hot-reloaded development (via Nodemon):
     ```bash
     npm run dev
     ```

### 3. Set Up the Frontend

1. Navigate to the `frontend/` directory.
2. In `app.js`, verify that `API_BASE` points to your backend URL:
   ```javascript
   const API_BASE = 'http://localhost:5000';
   ```
3. Run the application:
   - Double-click `index.html` to open it directly in your browser, or
   - Host it locally using a simple HTTP server:
     ```bash
     npx serve .
     ```

---

## API Endpoints Reference

| Method | Endpoint | Description | Payloads |
| :--- | :--- | :--- | :--- |
| **GET** | `/customers` | Returns all customer records sorted by date | None |
| **POST** | `/customers` | Creates a new customer log | JSON Customer Object |
| **PUT** | `/customers/:id` | Updates a customer log by ID | JSON Customer Object |
| **DELETE**| `/customers/:id` | Deletes a customer log by ID | None |
| **GET** | `/customers/export`| Downloads all logs in RFC 4180 CSV file format | None |

> [!NOTE]
> All endpoints are also accessible under the `/api` prefix (e.g. `/api/customers`), which enables flexible API versioning.

---

## Deployment Guide

### Deploying the Backend (API)

The backend expects a `MONGODB_URI` environment variable to connect to the database. Make sure you set up a free MongoDB database on MongoDB Atlas before deploying.

#### Option A: Railway (Recommended)
1. Install the Railway CLI or connect your GitHub repository.
2. Log in and create a new project.
3. Add a **MongoDB** database to your Railway project (Railway will automatically inject a `MONGODB_URI` variable), or link your Atlas cluster in the **Variables** tab under `MONGODB_URI`.
4. Deploy the `backend/` directory. Railway will automatically detect the `package.json` file and start `server.js` using `npm start`.

#### Option B: Render
1. Create a new account at [Render](https://render.com/).
2. Create a new **Web Service** and link your GitHub repository.
3. In the settings, configure:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Add the following **Environment Variables**:
   - `MONGODB_URI`: (Your Atlas connection URI string)
   - `PORT`: `5000`

---

### Deploying the Frontend

Before deploying, **update the `API_BASE` variable** in `frontend/app.js` to point to your live, deployed backend URL.

#### Option A: Vercel
1. Install the Vercel CLI (`npm install -g vercel`) or deploy via Vercel's GitHub integration.
2. Run `vercel` inside the `frontend/` directory.
3. Follow the CLI wizard to deploy immediately.

#### Option B: Netlify
1. Connect your repository to [Netlify](https://www.netlify.com/).
2. Create a new site from Git.
3. Set the **Base Directory** to `frontend/`.
4. Leave the Build Command empty and set the Publish Directory to `.` (the root of the frontend folder).

#### Option C: GitHub Pages
1. Push the contents of the `frontend` folder to a repository on GitHub (or use a branch).
2. Go to the repository **Settings** -> **Pages**.
3. Under **Build and deployment**, select your branch and deployment folder (typically `/root` if it's a dedicated repo, or using GitHub Actions to deploy).
