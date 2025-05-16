declare module '@mapbox/mapbox-sdk/lib/classes/mapi-client' {
  class MapiClient {
    constructor(options: { accessToken: string });
  }
  export = MapiClient;
}

declare module '@mapbox/mapbox-sdk/services/geocoding' {
  import MapiClient from '@mapbox/mapbox-sdk/lib/classes/mapi-client';
  
  interface GeocodingOptions {
    query: string;
    limit?: number;
    types?: string[];
    countries?: string[];
    proximity?: [number, number];
  }
  
  interface GeocodingResponse {
    send: () => Promise<{
      body: {
        features: Array<{
          id: string;
          place_name: string;
          center: [number, number]; // [longitude, latitude]
          geometry: {
            type: string;
            coordinates: [number, number];
          };
          properties: any;
        }>;
      };
    }>;
  }
  
  interface GeocodingService {
    forwardGeocode: (options: GeocodingOptions) => GeocodingResponse;
    reverseGeocode: (options: {
      query: [number, number];
      limit?: number;
      types?: string[];
    }) => GeocodingResponse;
  }
  
  function GeocodingService(client: MapiClient): GeocodingService;
  export = GeocodingService;
} 