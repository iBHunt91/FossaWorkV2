import React from 'react';
import HomeContent from '../components/home/HomeContent';
import PersistentView from '../components/PersistentView';

/**
 * Home page component
 * 
 * This is the main entry point for the dashboard home page.
 * It has been refactored to use smaller, more manageable components
 * that are located in the src/components/home directory.
 */
function Home() {
  return (
    <PersistentView id="home-dashboard" persistScrollPosition={true}>
      <HomeContent />
    </PersistentView>
  );
}

export default Home;
