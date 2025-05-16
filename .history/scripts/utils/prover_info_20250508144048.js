import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import * as logger from './logger.js';
import { resolveUserFilePath, getActiveUser } from '../../server/utils/userManager.js';

// Configure paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Use resolveUserFilePath for user-specific preferences
const getDataPath = () => resolveUserFilePath('prover_preferences.json');

/**
 * Get prover information from the preferences file
 */
async function getProverPreferences() {
    const dataPath = getDataPath();
    const activeUser = getActiveUser();
    logger.info('Prover Info', `Checking for existing prover preferences for user: ${activeUser || 'none'}`);
    logger.info('Prover Info', `Looking for file at: ${dataPath}`);
    
    try {
        // Check if the file exists
        const fileExists = await fs.access(dataPath).then(() => true).catch(() => false);
        
        if (!fileExists) {
            // Create an empty file without sample data
            logger.info('Prover Info', 'Creating empty prover preferences file');
            
            const emptyData = {
                provers: [],
                last_updated: new Date().toISOString()
            };
            
            // Ensure directory exists
            const dir = path.dirname(dataPath);
            await fs.mkdir(dir, { recursive: true });
            
            await fs.writeFile(dataPath, JSON.stringify(emptyData, null, 2));
            logger.success('Prover Info', `Created empty prover preferences file at ${dataPath}`);
            
            return emptyData;
        } else {
            // Read the existing file
            const data = JSON.parse(await fs.readFile(dataPath, 'utf8'));
            logger.success('Prover Info', `Found ${data.provers?.length || 0} existing provers for user ${activeUser || 'none'}`);
            
            // Ensure all provers have preferred_fuel_type, preferred_fuel_types and priority
            let updated = false;
            
            data.provers?.forEach(prover => {
                if (!prover.preferred_fuel_type) {
                    prover.preferred_fuel_type = "Regular"; // Default to Regular
                    updated = true;
                }
                
                // Ensure preferred_fuel_types exists and is populated
                if (!prover.preferred_fuel_types) {
                    prover.preferred_fuel_types = [prover.preferred_fuel_type];
                    updated = true;
                }
                
                if (prover.priority === undefined) {
                    prover.priority = 3; // Default to lowest priority
                    updated = true;
                }
            });
            
            // Update last_updated timestamp if changed
            if (updated) {
                data.last_updated = new Date().toISOString();
                await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
                logger.success('Prover Info', 'Updated prover preferences with defaults');
            }
            
            return data;
        }
    } catch (error) {
        logger.error('Prover Info Error', error.message);
        throw error;
    }
}

/**
 * Update the preferred fuel types for a specific prover
 */
async function updateProverPreference(proverId, fuelType, priority, preferred_fuel_types) {
    try {
        // Get current preferences
        const data = await getProverPreferences();
        const dataPath = getDataPath();
        
        // Find the prover
        const prover = data.provers.find(p => p.prover_id === proverId);
        
        if (!prover) {
            logger.error('Prover Update', `Prover with ID ${proverId} not found`);
            return { success: false, error: `Prover with ID ${proverId} not found` };
        }
        
        // Update the preferred fuel type for backward compatibility
        if (fuelType) {
            prover.preferred_fuel_type = fuelType;
            logger.success('Prover Update', `Updated fuel preference for prover ${proverId} to ${fuelType}`);
        }
        
        // Update preferred_fuel_types if provided
        if (preferred_fuel_types) {
            prover.preferred_fuel_types = preferred_fuel_types;
            // Update single fuel type with first item in array for backward compatibility
            if (preferred_fuel_types.length > 0) {
                prover.preferred_fuel_type = preferred_fuel_types[0];
            }
            logger.success('Prover Update', `Updated multiple fuel preferences for prover ${proverId}`);
        }
        
        // Update priority if provided
        if (priority !== undefined) {
            prover.priority = priority;
        }
        
        data.last_updated = new Date().toISOString();
        
        // Save the updated preferences
        await fs.writeFile(dataPath, JSON.stringify(data, null, 2));
        logger.success('Prover Update', `Updated preference for prover ${proverId}`);
        
        return { success: true, data };
    } catch (error) {
        logger.error('Prover Update Error', error.message);
        return { success: false, error: error.message };
    }
}

// If the script is run directly
if (import.meta.url === `file://${fileURLToPath(import.meta.url)}`) {
    getProverPreferences()
        .then((data) => {
            console.log('Prover preferences:');
            console.log(JSON.stringify(data.provers, null, 2));
            logger.success('Script Complete', 'Prover information retrieved successfully');
        })
        .catch(error => {
            logger.error('Script Error', error.message || 'Unknown error');
            process.exit(1);
        });
}

// Export the functions for use in other scripts
export { getProverPreferences, updateProverPreference, getDataPath }; 