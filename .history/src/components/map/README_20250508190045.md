# Job Map Feature

This component uses Mapbox to visualize job locations on a map, allow filtering by date, and provide route planning functionality.

## Setup

### Mapbox Access Token

To use the map features, you need to provide a Mapbox access token:

1. Sign up for a Mapbox account at [https://www.mapbox.com/](https://www.mapbox.com/)
2. Create an access token in your Mapbox account
3. Add your token to your `.env` file:

```
VITE_MAPBOX_ACCESS_TOKEN=your_actual_token_here
```

4. Restart your application

### Alternative Map Providers

If you prefer not to use Mapbox, you can modify the implementation to use one of these alternatives:

- **OpenLayers**: Free and open-source
- **Leaflet**: Free and lightweight
- **HERE Maps**: Free tier available
- **TomTom**: Free tier available

## Features

- Display job locations on an interactive map
- Filter jobs by day, week, month, or custom date range
- View job details in a sidebar list
- Select jobs to see more information
- Plan routes between your location and job sites
- Responsive design for desktop and mobile views

## Troubleshooting

If you see map errors:

1. Check that your Mapbox token is correctly set in your `.env` file
2. Ensure the token has the required permissions (Maps, Geocoding, Directions)
3. Verify your token is not expired or has usage restrictions

## Development

To further enhance this component, consider:

- Adding marker clustering for large numbers of jobs
- Implementing optimized route planning for multiple jobs
- Adding traffic layer support
- Extending filter options (status, client, etc.)
- Adding the ability to save or share routes 