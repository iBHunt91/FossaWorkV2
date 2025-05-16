import React from 'react';
import PersistentView from '../components/PersistentView';
import FiltersContent from '../components/filters/FiltersContent';

/**
 * Filters page component
 * 
 * This is the main entry point for the filters page.
 * It has been refactored to use smaller, more manageable components
 * that are located in the src/components/filters directory.
 */
function Filters() {
  return (
    <PersistentView id="filters-page" persistScrollPosition={true}>
      <FiltersContent />
    </PersistentView>
  );
}

export default Filters;