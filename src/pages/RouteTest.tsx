import React from 'react';
import { useLocation } from 'react-router-dom';

const RouteTest: React.FC = () => {
  const location = useLocation();
  
  return (
    <div style={{ padding: '20px' }}>
      <h1>Route Test Page</h1>
      <p>Current pathname: {location.pathname}</p>
      <p>Current search: {location.search}</p>
      <p>Current hash: {location.hash}</p>
      <h2>Available Routes:</h2>
      <ul>
        <li><a href="/home">Home</a></li>
        <li><a href="/schedule">Schedule</a></li>
        <li><a href="/schedule-debug">Schedule Debug</a></li>
        <li><a href="/test">Test</a></li>
      </ul>
    </div>
  );
};

export default RouteTest;