import fs from 'fs';

try {
  const content = fs.readFileSync('src/pages/History.tsx', 'utf8');
  
  // Make sure the import line is properly terminated
  if (!content.includes("} from 'react-icons/fi';")) {
    const fixedContent = content.replace(
      /import { FiCalendar.*FiTrash2[^}]*/, 
      "import { FiCalendar, FiChevronDown, FiChevronUp, FiAlertCircle, FiPlusCircle, FiArrowRight, FiRefreshCw, FiSearch, FiFilter, FiChevronLeft, FiChevronRight, FiClock, FiList, FiArchive, FiFile, FiTrash2, FiEye, FiChevronsLeft, FiChevronsRight } from 'react-icons/fi'"
    );
    
    fs.writeFileSync('src/pages/History.tsx', fixedContent, 'utf8');
    console.log('Fixed import statement in History.tsx');
  } else {
    console.log('Import statement appears to be correct already');
  }
} catch (err) {
  console.error('Error:', err);
} 