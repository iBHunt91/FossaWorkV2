# Fossa Monitor Server

> **Note**: For comprehensive documentation, please refer to:
> - [Technical Documentation](../docs/technical.md) - Detailed technical specifications and patterns
> - [User Guide](../docs/user-guide.md) - User-focused documentation and features
> - [Architecture Documentation](../docs/architecture.md) - System architecture and design

This directory contains the backend server code for the Fossa Monitor application.

## Directory Structure

- `config/`: Configuration files and environment settings
- `controllers/`: Application controllers for handling business logic
- `routes/`: Express route definitions
- `services/`: Service layer for business logic
- `utils/`: Utility functions and helpers

## Getting Started

To start the server:

```bash
npm start
```

Or for development with auto-reload:

```bash
npm run dev
```

## Starting the Full Application

To start the complete Fossa Monitor application (including the Electron desktop app, frontend, and server):

```bash
npm run electron:dev:start
```

This command will:
- Start the backend server
- Launch the frontend development server
- Open the Electron desktop application
- Handle process cleanup and port management

For other startup options:
- `npm run electron:dev`: Start without process management
- `npm run electron:start`: Start only the Electron app
- `npm run start`: Start only the frontend and server

## API Endpoints

### Work Order Scraping

- `GET /api/status`: Get the current status of work order scraping
- `POST /api/scrape`: Start a work order scraping job

### Dispenser Scraping

- `GET /api/dispenser-status`: Get the current status of dispenser scraping
- `POST /api/dispenser-scrape`: Start a dispenser scraping job

## Environment Variables

The server uses environment variables for configuration. See `.env.example` for a list of required variables. 