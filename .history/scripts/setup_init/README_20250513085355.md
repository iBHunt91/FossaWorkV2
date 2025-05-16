# Setup and Initialization Scripts

This directory contains scripts for setting up and initializing the Fossa Monitor application.

## Scripts

- `setup.js` - Handles initial application setup and configuration
- `init-data.js` - Initializes application data from templates
- `bootstrap-templates.js` - Creates and populates template files for various app components

## Usage

These scripts are typically run during the initial setup of the application or when creating new data structures:

```bash
# Run initial setup
node scripts/setup_init/setup.js

# Initialize data from templates
node scripts/setup_init/init-data.js

# Bootstrap templates
node scripts/setup_init/bootstrap-templates.js
```

## Package.json Scripts

These scripts are referenced in package.json with scripts like:

```json
{
  "scripts": {
    "setup": "node scripts/setup_init/setup.js",
    "bootstrap-templates": "node scripts/setup_init/bootstrap-templates.js",
    "init-data": "node --input-type=module -e \"import { initializeDataFromTemplates } from './scripts/setup_init/init-data.js'; initializeDataFromTemplates();\""
  }
}
```

## Setup Process

The setup process handled by these scripts includes:

1. Checking for necessary directories and creating them if they don't exist
2. Initializing configuration files with default values
3. Setting up template data structures
4. Creating sample data for development if needed
5. Verifying that all required components are in place

## Template System

The template system is used to create consistent data structures throughout the application:

- Templates are stored in the `data/templates` directory
- Templates can be customized and extended as needed
- The bootstrap process copies templates to create new instances of components 