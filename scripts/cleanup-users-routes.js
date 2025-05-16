// Script to clean up the users routes file
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cleanupUsersRoutes = () => {
  const filePath = path.join(__dirname, '../server/routes/users.js');
  
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Find the first occurrence of the credential route
    const firstCredentialRoute = content.indexOf('// Update user credentials');
    const secondCredentialRoute = content.indexOf('// Update user credentials - moved before delete route');
    
    if (firstCredentialRoute !== -1 && secondCredentialRoute !== -1) {
      // Remove the duplicate route (from second occurrence to next route)
      const startOfDuplicate = secondCredentialRoute;
      
      // Find the end of the duplicate route (where the next route starts)
      const nextRoutePattern = /router\.(get|post|put|patch|delete|all)\(/;
      const remainingContent = content.substring(startOfDuplicate);
      const match = remainingContent.match(nextRoutePattern);
      
      if (match && match.index) {
        // Find the actual end by checking for the closing brace
        let braceCount = 0;
        let endOfDuplicate = startOfDuplicate;
        let inRoute = false;
        
        for (let i = startOfDuplicate; i < content.length; i++) {
          if (content[i] === '{') {
            braceCount++;
            inRoute = true;
          } else if (content[i] === '}') {
            braceCount--;
            if (inRoute && braceCount === 0) {
              endOfDuplicate = i + 1;
              // Skip to next non-whitespace
              while (endOfDuplicate < content.length && /\s/.test(content[endOfDuplicate])) {
                endOfDuplicate++;
              }
              break;
            }
          }
        }
        
        // Remove the duplicate section
        content = content.substring(0, startOfDuplicate) + content.substring(endOfDuplicate);
        
        // Save the cleaned content
        fs.writeFileSync(filePath, content, 'utf8');
        console.log('Successfully cleaned up duplicate routes');
      }
    } else {
      console.log('No duplicate routes found');
    }
    
  } catch (error) {
    console.error('Error cleaning up routes:', error);
  }
};

cleanupUsersRoutes();