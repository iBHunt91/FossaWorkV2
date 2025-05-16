import React, { useState, useEffect } from 'react';
import { WorkOrder } from '../types';
import { calculateFiltersForWorkOrder } from '../utils/filterCalculation';
import FilterUtils from '../components/filters/FilterUtils';
import scrapedData from '../data/scraped_content.json';

/**
 * Diagnostic component to debug filter calculation issues
 */
const FilterDebugger: React.FC = () => {
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const runDiagnostics = async () => {
      try {
        // Check if scrapedData exists and has workOrders property
        console.log("1. Checking scraped data...");
        if (!scrapedData) {
          setError("scrapedData is not available");
          return;
        }
        
        console.log("2. scrapedData structure:", Object.keys(scrapedData).join(", "));
        
        if (!scrapedData.workOrders || !Array.isArray(scrapedData.workOrders)) {
          setError("scrapedData.workOrders is not an array");
          return;
        }
        
        console.log(`3. Found ${scrapedData.workOrders.length} work orders in scraped data`);
        
        // Check a sample work order
        if (scrapedData.workOrders.length > 0) {
          const sampleOrder = scrapedData.workOrders[0];
          console.log("4. Sample work order:", {
            id: sampleOrder.id,
            customer: sampleOrder.customer?.name,
            hasDiepensers: !!sampleOrder.dispensers,
            dispenserCount: sampleOrder.dispensers?.length || 0
          });
          
          // Try the original function
          console.log("5. Testing calculateFiltersForWorkOrder directly...");
          try {
            const originalResult = calculateFiltersForWorkOrder(sampleOrder);
            console.log("6. Original filter calculation result:", originalResult);
            
            if (originalResult && originalResult.warnings) {
              console.log(`7. Original function returned ${originalResult.warnings.length} warnings`);
            } else {
              console.log("7. No warnings in original result");
            }
          } catch (err) {
            console.error("Error in original filter calculation:", err);
            setError(`Original filter calculation error: ${err.message}`);
          }
          
          // Try our utility function
          console.log("8. Testing FilterUtils.calculateFiltersSafely...");
          try {
            const utilResult = FilterUtils.calculateFiltersSafely(sampleOrder);
            console.log("9. Utility filter calculation result:", utilResult);
            console.log(`10. Utility function returned ${utilResult.length} warnings`);
          } catch (err) {
            console.error("Error in utility filter calculation:", err);
            setError(`Utility filter calculation error: ${err.message}`);
          }
          
          // Test generateFilterNeeds
          console.log("11. Testing FilterUtils.generateFilterNeeds...");
          try {
            const filterNeeds = FilterUtils.generateFilterNeeds([sampleOrder]);
            console.log("12. generateFilterNeeds result:", filterNeeds);
            console.log(`13. generateFilterNeeds returned ${filterNeeds.length} filter needs`);
          } catch (err) {
            console.error("Error in generateFilterNeeds:", err);
            setError(`generateFilterNeeds error: ${err.message}`);
          }
          
          // Test generateFilterWarnings
          console.log("14. Testing FilterUtils.generateFilterWarnings...");
          try {
            const filterWarnings = FilterUtils.generateFilterWarnings([sampleOrder], null);
            console.log("15. generateFilterWarnings result:", filterWarnings);
            console.log(`16. generateFilterWarnings returned warnings for ${filterWarnings.size} orders`);
          } catch (err) {
            console.error("Error in generateFilterWarnings:", err);
            setError(`generateFilterWarnings error: ${err.message}`);
          }
          
          // Collect all results
          const diagnosticResults = [
            { name: "Work Orders Count", value: scrapedData.workOrders.length },
            { name: "Sample Order ID", value: sampleOrder.id },
            { name: "Sample Order Customer", value: sampleOrder.customer?.name || "Unknown" },
            { name: "Sample Order Has Dispensers", value: !!sampleOrder.dispensers },
            { name: "Sample Order Dispenser Count", value: sampleOrder.dispensers?.length || 0 }
          ];
          
          setResults(diagnosticResults);
        } else {
          setError("No work orders found in scraped data");
        }
      } catch (err) {
        console.error("Global diagnostic error:", err);
        setError(`Global diagnostic error: ${err.message}`);
      }
    };
    
    runDiagnostics();
  }, []);
  
  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Filter Calculation Diagnostics</h2>
      
      {error && (
        <div className="bg-red-100 dark:bg-red-900/20 p-4 rounded-md mb-4">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}
      
      <div className="mb-4">
        <p className="text-gray-600 dark:text-gray-400 mb-2">
          Check the browser console for detailed logs. Below is a summary of findings:
        </p>
      </div>
      
      <div className="overflow-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-900/50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Test</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Result</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result, index) => (
              <tr key={index}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {result.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {result.value !== undefined ? result.value.toString() : "undefined"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6">
        <h3 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Recommendations:</h3>
        <ol className="list-decimal list-inside text-gray-600 dark:text-gray-400 space-y-2">
          <li>Check if the calculateFiltersForWorkOrder function is returning warnings properly</li>
          <li>Verify that the workOrders data structure matches what the calculation functions expect</li>
          <li>Look for any errors in the console that might indicate why filters aren't being calculated</li>
          <li>Consider trying with a mock work order that has the expected structure</li>
        </ol>
      </div>
    </div>
  );
};

export default FilterDebugger;