# Web UI Dashboard Design

## Overview

A single HTML page served at `GET /` from the Fastify server for reviewing and approving/rejecting proposals. Vanilla HTML/CSS/JS, no framework, no build step. Responsive for desktop and mobile.

## What it shows

- **Pending proposals** at the top (primary action area)
- Each proposal card shows: adapter, action, params, timestamp
- **Approve** and **Reject** buttons on each pending proposal
- **History section** below showing recently resolved proposals (approved/rejected/expired)
- Auto-polls every 5 seconds for new proposals
- JWT token entered once via a text input and stored in localStorage

## Server changes

- `GET /` serves the HTML page (no auth required — the page is static markup)
- The page calls existing API endpoints with the JWT from localStorage:
  - `GET /proposals` — list proposals
  - `GET /proposals?status=pending` — pending only
  - `POST /proposals/:id/approve` — approve
  - `POST /proposals/:id/reject` — reject

## Approach

- HTML is a string template served from a Fastify route in a new `ui-routes.ts` file
- CSS is inline (responsive, works on mobile)
- JS is inline (fetch + polling, no framework)
- No new packages or dependencies
- Registered in `main.ts` alongside other routes
