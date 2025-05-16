import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiTool, FiCalendar, FiUser, FiInfo, FiTag, FiHardDrive } from 'react-icons/fi';

interface DispenserNote {
  text: string;
  category?: string;
  date?: string;
}

interface DispenserSpecs {
  make?: string;
  model?: string;
  grade?: string;
  standAloneCode?: string;
  nozzlesPerSide?: string;
  meterType?: string;
  serial?: string;
  title?: string;
}

const DispenserDetails: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [dispenserInfo, setDispenserInfo] = useState<DispenserNote[] | null>(null);
  const [dispenserSpecs, setDispenserSpecs] = useState<DispenserSpecs[] | null>(null);
  const [orderInfo, setOrderInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get dispenserHtml and order info from location state
    const state = location.state as any;
    if (state) {
      setOrderInfo(state.orderInfo || {});
      
      if (state.dispensers && state.dispensers.length > 0) {
        // Use dispensers array if available
        setDispenserSpecs(getDispenserSpecs(state.dispensers));
      } else if (state.dispenserHtml) {
        // Fallback to HTML parsing
        setDispenserSpecs(extractDispenserSpecs(state.dispenserHtml));
      }
      
      if (state.dispenserHtml) {
        const notes = extractNoteInfo(state.dispenserHtml);
        setDispenserInfo(notes);
      }
    }
    
    setLoading(false);
  }, [location]);

  // Extract dispenser specifications from the dispensers array
  const getDispenserSpecs = (dispensers: any[]): DispenserSpecs[] => {
    return dispensers.map(dispenser => {
      const specs: DispenserSpecs = {
        title: dispenser.title || '',
        serial: dispenser.serial || '',
        make: dispenser.make?.replace('Make: ', '') || '',
        model: dispenser.model?.replace('Model: ', '') || '',
      };

      // Extract fields from the fields object
      if (dispenser.fields) {
        specs.grade = dispenser.fields['Grade'] || '';
        specs.standAloneCode = dispenser.fields['Stand Alone Code'] || '';
        specs.nozzlesPerSide = dispenser.fields['Number of Nozzles (per side)'] || '';
        specs.meterType = dispenser.fields['Meter Type'] || '';
      }

      return specs;
    });
  };

  // Extract the useful information from the HTML
  const extractNoteInfo = (html: string): DispenserNote[] | null => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      
      // Find all note elements
      const noteElements = doc.querySelectorAll('.note');
      
      if (noteElements.length === 0) {
        return null;
      }
      
      const notes = Array.from(noteElements).map(note => {
        // Get note content
        const noteContent = note.querySelector('.note.text-sm');
        const textContent = noteContent ? noteContent.innerHTML : '';
        
        // Get category (e.g., "Scheduling", "Work", "Invoice")
        const badge = note.querySelector('.ks-badge');
        const category = badge ? badge.textContent?.trim() : '';
        
        // Get date info
        const dateElement = note.querySelector('.note-date');
        const dateInfo = dateElement ? dateElement.textContent?.trim() : '';
        
        return {
          text: textContent,
          category,
          date: dateInfo
        };
      });
      
      return notes;
    } catch (error) {
      console.error('Error parsing dispenser HTML:', error);
      return null;
    }
  };

  // Fallback method if dispensers array is not available
  const extractDispenserSpecs = (html: string): DispenserSpecs[] => {
    const specs: DispenserSpecs = {};
    
    // Parse from the main title or header
    const titleMatch = html.match(/(\d\/\d)\s*-\s*(.*?)\s*-\s*([\w-]+)/);
    if (titleMatch) {
      specs.title = titleMatch[0].trim();
      specs.grade = titleMatch[2].trim();
      specs.make = titleMatch[3].trim();
    }
    
    // Extract specific fields
    const makeMatch = html.match(/MAKE:\s*([\w-]+)/i);
    if (makeMatch) specs.make = makeMatch[1].trim();
    
    const modelMatch = html.match(/MODEL:\s*([\w\d-]+)/i);
    if (modelMatch) specs.model = modelMatch[1].trim();
    
    const codeMatch = html.match(/STAND\s*ALONE\s*CODE\s*(\d+)/i);
    if (codeMatch) specs.standAloneCode = codeMatch[1].trim();
    
    const nozzlesMatch = html.match(/NUMBER\s*OF\s*NOZZLES\s*\(PER\s*SIDE\)\s*(\d+)/i);
    if (nozzlesMatch) specs.nozzlesPerSide = nozzlesMatch[1].trim();
    
    const meterTypeMatch = html.match(/METER\s*TYPE\s*([\w-]+)/i);
    if (meterTypeMatch) specs.meterType = meterTypeMatch[1].trim();
    
    return [specs];
  };

  const formatDispenserInfo = (text: string) => {
    // Convert line breaks to proper HTML
    return text.replace(/\n<br>/g, '<br>').replace(/\n/g, '<br>');
  };

  const renderDispenserSpec = (spec: DispenserSpecs, index: number) => {
    return (
      <div key={index} className="mb-6 bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-100 dark:border-purple-800">
        <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-300 mb-3 flex items-center">
          <FiHardDrive className="mr-2" /> 
          {spec.title || `Dispenser ${index + 1}`}
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {spec.serial && (
            <div className="flex items-start">
              <span className="font-medium text-gray-600 dark:text-gray-300 min-w-[120px]">Serial Number:</span>
              <span className="text-gray-800 dark:text-gray-200">{spec.serial}</span>
            </div>
          )}
          
          {spec.grade && (
            <div className="flex items-start">
              <span className="font-medium text-gray-600 dark:text-gray-300 min-w-[120px]">Fuel Types:</span>
              <span className="text-gray-800 dark:text-gray-200">{spec.grade}</span>
            </div>
          )}
          
          {spec.make && (
            <div className="flex items-start">
              <span className="font-medium text-gray-600 dark:text-gray-300 min-w-[120px]">Make:</span>
              <span className="text-gray-800 dark:text-gray-200">{spec.make}</span>
            </div>
          )}
          
          {spec.model && (
            <div className="flex items-start">
              <span className="font-medium text-gray-600 dark:text-gray-300 min-w-[120px]">Model:</span>
              <span className="text-gray-800 dark:text-gray-200">{spec.model}</span>
            </div>
          )}
          
          {spec.nozzlesPerSide && (
            <div className="flex items-start">
              <span className="font-medium text-gray-600 dark:text-gray-300 min-w-[120px]">Nozzles Per Side:</span>
              <span className="text-gray-800 dark:text-gray-200">{spec.nozzlesPerSide}</span>
            </div>
          )}
          
          {spec.meterType && (
            <div className="flex items-start">
              <span className="font-medium text-gray-600 dark:text-gray-300 min-w-[120px]">Meter Type:</span>
              <span className="text-gray-800 dark:text-gray-200">{spec.meterType}</span>
            </div>
          )}
          
          {spec.standAloneCode && (
            <div className="flex items-start">
              <span className="font-medium text-gray-600 dark:text-gray-300 min-w-[120px]">Code:</span>
              <span className="text-gray-800 dark:text-gray-200">{spec.standAloneCode}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="mb-6">
          <button 
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          >
            <FiArrowLeft className="mr-2" /> Back to Work Orders
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
          <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
              <FiInfo className="mr-2" /> Dispenser Information
            </h1>
            {orderInfo && (
              <div className="mt-2">
                {orderInfo.id && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Work Order: <span className="font-semibold text-gray-700 dark:text-gray-300">{orderInfo.id}</span>
                  </div>
                )}
                {orderInfo.customer?.name && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Customer: <span className="font-semibold text-gray-700 dark:text-gray-300">{orderInfo.customer.name} {orderInfo.customer.storeNumber || ''}</span>
                  </div>
                )}
                {orderInfo.address && (
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Location: <span className="font-semibold text-gray-700 dark:text-gray-300">{orderInfo.address}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="px-6 py-4">
            {/* Dispenser Specifications */}
            {dispenserSpecs && dispenserSpecs.length > 0 ? (
              <div className="mb-6">
                {dispenserSpecs.map((spec, index) => renderDispenserSpec(spec, index))}
              </div>
            ) : (
              <div className="mb-6 text-center py-4">
                <p className="text-gray-500 dark:text-gray-400">No dispenser specifications available</p>
              </div>
            )}
            
            {/* Notes Section */}
            <div className="mt-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <FiTag className="mr-2" /> Additional Notes
              </h2>
              
              {dispenserInfo && dispenserInfo.length > 0 ? (
                <div className="space-y-4">
                  {dispenserInfo.map((note, index) => (
                    <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-5 border border-gray-200 dark:border-gray-600">
                      <div className="flex items-start">
                        <FiUser className="mt-1 mr-3 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <div className="flex-1">
                          <div 
                            className="text-gray-700 dark:text-gray-300 mb-3" 
                            dangerouslySetInnerHTML={{ __html: formatDispenserInfo(note.text) }}
                          />
                          
                          {(note.category || note.date) && (
                            <div className="flex flex-wrap justify-between items-center pt-3 border-t border-gray-200 dark:border-gray-600 text-sm">
                              {note.category && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300 mb-2 md:mb-0">
                                  <FiTool className="mr-1.5" /> {note.category}
                                </span>
                              )}
                              {note.date && (
                                <span className="text-gray-500 dark:text-gray-400 flex items-center">
                                  <FiCalendar className="mr-1.5" /> {note.date.replace(/\s+on\s+/, '')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center">
                  <p className="text-gray-500 dark:text-gray-400">No additional notes available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DispenserDetails; 