# Build Log

## 2026-09-02

### Project setup
- Created the Node.js + Express project.
- Installed Express, Zod, PostgreSQL driver, dotenv, and Nodemon.
- Added project folder structure.
- Added `.gitignore`.
- Added PostgreSQL with Docker Compose.
- Verified PostgreSQL is running.
- Verified Node.js can connect to PostgreSQL.

### Database
- Created `images` table.
- Created `image_metadata` table.
- Created `posts` table.
- Created `embeddings` table.
- Created `suggestions` table.
- Created `reviews` table.
- Added indexes for common lookups.

### Design
- Created `DESIGN.md`.
- Defined the image understanding pipeline.
- Defined semantic matching and mismatch guard.
- Defined planned API endpoints.
- Defined background processing and evaluation approach.