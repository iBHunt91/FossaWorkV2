import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiPlay, FiCheck, FiX, FiSquare, FiSearch, FiClock, 
  FiInfo, FiFilter, FiMaximize2, FiMinimize2, FiAlertCircle,
  FiChevronRight, FiArrowLeft, FiSettings
} from 'react-icons/fi';
import { useToast } from '../context/ToastContext';

interface Category {
  [key: string]: {
    [key: string]: string;
  };
}

interface Script {
  name: string;
  path: string;
  status: 'idle' | 'running' | 'completed' | 'error';
  lastRun?: string;
  description: string;
  category: string;
  type: 'gas' | 'diesel' | 'hybrid';
  grades: number;
}

interface ScriptHistory {
  timestamp: string;
  scriptName: string;
  status: 'completed' | 'error';
  duration?: string;
  error?: string;
  category: string;
}

interface Filter {
  type: ('gas' | 'diesel' | 'hybrid')[];
  grades: number[];
  categories: string[];
}

interface Dispenser {
  id: string;
  name: string;
  description: string;
  image?: string;
  categories: string[];
}

// Enhanced script descriptions
const scriptDescriptions: { [key: string]: string } = {
  "3 Grade Gas (M+M)": "3-grade gas configuration using Master + Master metering. Suitable for standard gas dispensers.",
  "3 Grade Gas (M+B)": "3-grade gas setup with Master + Blend metering. Optimized for blended fuel products.",
  "3 Grade W/ Diesel (M+MM)": "3-grade configuration with diesel, using Master + Master + Master metering. Ideal for combined gas/diesel dispensers.",
  "4 Grade Gas (M++M)": "4-grade gas setup with Master + Blend + Blend + Master configuration. Best for high-volume stations.",
  // Add more detailed descriptions
};

// Script metadata to help with filtering and organization
const getScriptMetadata = (name: string, category: string): Partial<Script> => {
  const isDiesel = name.toLowerCase().includes('diesel');
  const isGas = name.toLowerCase().includes('gas');
  const gradeMatch = name.match(/(\d+)\s*Grade/);
  
  return {
    type: isDiesel ? (isGas ? 'hybrid' : 'diesel') : 'gas',
    grades: gradeMatch ? parseInt(gradeMatch[1]) : 0,
    category
  };
};

const categories: Category = {
  "Gilbarco 300/Wayne": {
    "3 Grade Gas (M+M)": "scripts/AutoFossa/scripts/300_Wayne_3_Grade_No_Diesel_MMB.py",
    "3 Grade Gas (M+B)": "scripts/AutoFossa/scripts/300_Wayne_3_Grade_No_Diesel_MBM.py",
    "3 Grade W/ Diesel (M+MM)": "scripts/AutoFossa/scripts/300_Wayne_3_Grade_Diesel_MBMM.py",
    "3 Grade W/ Diesel (MM+M)": "scripts/AutoFossa/scripts/300_Wayne_3_Grade_Diesel_MMBM.py",
    "4 Grade Gas (M++M)": "scripts/AutoFossa/scripts/300_Wayne_4_Grade_No_Diesel_MBBM.py",
    "4 Grade Gas (MM++)": "scripts/AutoFossa/scripts/300_Wayne_4_Grade_No_Diesel_MMBB.py",
    "4 Grade W/ Diesel (M++MM)": "scripts/AutoFossa/scripts/300_Wayne_4_Grade - Diesel_MBBMM.py",
    "4 Grade W/ Diesel (MM++M)": "scripts/AutoFossa/scripts/300_Wayne_4_Grade - Diesel_MMBBM.py",
    "5 Grade Gas (M+++M)": "scripts/AutoFossa/scripts/300_Wayne_5_Grade_No_Diesel_MBBBM.py",
    "5 Grade W/ Diesel (M+++M)": "scripts/AutoFossa/scripts/300_Wayne_5_Grade_Diesel_MBBBM.py",
    "Diesel Standalone (MM)": "scripts/AutoFossa/scripts/300_Wayne_Diesel_Standalone_MM.py",
  },
  "Gilbarco 500/700": {
    "3 Grade Gas (M+M)": "scripts/AutoFossa/scripts/700_3_Grade_No_Diesel_MMB.py",
    "3 Grade Gas (M+B)": "scripts/AutoFossa/scripts/700_3_Grade_No_Diesel_MBM.py",
    "3 Grade Gas (All Metered)": "scripts/AutoFossa/scripts/700_3_Grade_All Metered.py",
    "3 Grade Gas (M+B One Side)": "scripts/AutoFossa/scripts/700_3_Grade_No_Diesel_MBM (1 Side).py",
    "3 Grade W/ Diesel (M+MM)": "scripts/AutoFossa/scripts/700_3_Grade_Diesel_MBMM.py",
    "3 Grade W/ Diesel (MM+M)": "scripts/AutoFossa/scripts/700_3_Grade_Diesel_MMBM.py",
    "3 Grade W/ Diesel (MMM+B)": "scripts/AutoFossa/scripts/700_3_Grade_Diesel_MMMB.py",
    "4 Grade Gas (M++M)": "scripts/AutoFossa/scripts/700_4_Grade_No_Diesel_MBBM.py",
    "4 Grade Gas (MM++)": "scripts/AutoFossa/scripts/700_4_Grade_No_Diesel_MMBB.py",
    "4 Grade W/ Diesel (M++MM)": "scripts/AutoFossa/scripts/700_4_Grade_Diesel_MBBMM.py",
    "4 Grade W/ Diesel (MM++M)": "scripts/AutoFossa/scripts/700_4_Grade_Diesel_MMBBM.py",
    "Diesel Standalone (M)": "scripts/AutoFossa/scripts/700_Diesel_Standalone_M.py",
    "Diesel Standalone (MM)": "scripts/AutoFossa/scripts/700_Diesel_Standalone_MM.py",
  },
  "Circle K (Open Neck)": {
    "3 Grade Gas (M+M)": "scripts/AutoFossa/scripts/CK_3_Grade_No_Diesel_MMB.py",
    "3 Grade Gas (M+B)": "scripts/AutoFossa/scripts/CK_3_Grade_No_Diesel_MBM.py",
    "3 Grade W/ Diesel (M+MM)": "scripts/AutoFossa/scripts/CK_3_Grade_Diesel_MBMM.py",
    "3 Grade W/ Diesel (MM+M)": "scripts/AutoFossa/scripts/CK_3_Grade_Diesel_MMBM.py",
    "3 Grade W/ Diesel Non-Eth (M+MMM)": "scripts/AutoFossa/scripts/CK_3_Grade_Diesel_NonEth_MBMMM.py",
    "3 Grade W/ Diesel Non-Eth (MM+MM)": "scripts/AutoFossa/scripts/CK_3_Grade_Diesel_NonEth_MMBMM.py",
    "Diesel Standalone (MM)": "scripts/AutoFossa/scripts/CK_Diesel_Standalone_MM.py",
  },
  "Circle K (Accumeasure)": {
    "3 Grade W/ Ethanol & Diesel": "scripts/AutoFossa/scripts/CK_AM_3_Grade_Ethanol_Diesel.py",
  },
  "Wawa": {
    "3 Grade W/ Ethanol & Diesel": "scripts/AutoFossa/scripts/Wawa_3_Grade_Ethanol_Diesel.py",
    "4 Grade Gas": "scripts/AutoFossa/scripts/Wawa_4_Grade_Gas.py",
    "4 Grade W/ Diesel": "scripts/AutoFossa/scripts/Wawa_4_Grade_Diesel.py",
  },
  "Costco": {
    "Standard Test": "scripts/AutoFossa/scripts/Costco.py",
  }
};

const dispensers: Dispenser[] = [
  {
    id: 'gilbarco-300',
    name: 'Gilbarco 300/Wayne',
    description: 'Standard Gilbarco 300 series and Wayne dispensers',
    categories: ['Gilbarco 300/Wayne']
  },
  {
    id: 'gilbarco-500-700',
    name: 'Gilbarco 500/700',
    description: 'Gilbarco 500 and 700 series dispensers',
    categories: ['Gilbarco 500/700']
  },
  {
    id: 'circle-k-open',
    name: 'Circle K (Open Neck)',
    description: 'Circle K dispensers with open neck configuration',
    categories: ['Circle K (Open Neck)']
  },
  {
    id: 'circle-k-accumeasure',
    name: 'Circle K (Accumeasure)',
    description: 'Circle K dispensers with Accumeasure system',
    categories: ['Circle K (Accumeasure)']
  },
  {
    id: 'wawa',
    name: 'Wawa',
    description: 'Wawa specific dispenser configurations',
    categories: ['Wawa']
  },
  {
    id: 'costco',
    name: 'Costco',
    description: 'Costco specific dispenser configurations',
    categories: ['Costco']
  }
];

const API_BASE_URL = 'http://localhost:3000/api';

const AutoFossa: React.FC = () => {
  const [selectedDispenser, setSelectedDispenser] = useState<Dispenser | null>(null);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [status, setStatus] = useState<string>("Ready");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [scriptHistory, setScriptHistory] = useState<ScriptHistory[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [filters, setFilters] = useState<Filter>({
    type: ['gas', 'diesel', 'hybrid'],
    grades: [3, 4, 5],
    categories: []
  });
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const { addToast } = useToast();

  // Update available categories when dispenser is selected
  useEffect(() => {
    if (selectedDispenser) {
      setFilters(prev => ({
        ...prev,
        categories: selectedDispenser.categories
      }));
    }
  }, [selectedDispenser]);

  // Initialize scripts based on selected dispenser
  useEffect(() => {
    if (selectedDispenser) {
      const allScripts: Script[] = [];
      selectedDispenser.categories.forEach(category => {
        if (categories[category]) {
          Object.entries(categories[category]).forEach(([name, path]) => {
            const metadata = getScriptMetadata(name, category);
            allScripts.push({
              name,
              path,
              status: 'idle',
              description: scriptDescriptions[name] || "No description available",
              category,
              type: metadata.type || 'gas',
              grades: metadata.grades || 0
            });
          });
        }
      });
      setScripts(allScripts);
    } else {
      setScripts([]);
    }
  }, [selectedDispenser]);

  // Filter and search scripts
  const filteredScripts = useMemo(() => {
    return scripts.filter(script => {
      const matchesSearch = 
        script.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        script.description.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesFilters = 
        filters.type.includes(script.type) &&
        filters.grades.includes(script.grades) &&
        filters.categories.includes(script.category);

      return matchesSearch && matchesFilters;
    });
  }, [scripts, searchQuery, filters]);

  // Group scripts by category for grid view
  const groupedScripts = useMemo(() => {
    const groups: { [key: string]: Script[] } = {};
    filteredScripts.forEach(script => {
      if (!groups[script.category]) {
        groups[script.category] = [];
      }
      groups[script.category].push(script);
    });
    return groups;
  }, [filteredScripts]);

  const handleScriptAction = async (script: Script) => {
    try {
      if (script.status === 'idle' || script.status === 'error' || script.status === 'completed') {
        setScripts(prev => prev.map(s => 
          s.name === script.name ? { ...s, status: 'running' } : s
        ));
        setStatus(`Starting: ${script.name}`);
        addToast('info', `Starting script: ${script.name}`);

        const response = await fetch(`${API_BASE_URL}/auto-fossa/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptPath: script.path }),
        });

        if (!response.ok) throw new Error(`Failed to start script: ${response.statusText}`);
        setStatus(`Running: ${script.name}`);
        addToast('info', `Script ${script.name} is now running`);

      } else if (script.status === 'running') {
        setStatus(`Stopping: ${script.name}`);
        addToast('warning', `Stopping script: ${script.name}`);

        const response = await fetch(`${API_BASE_URL}/auto-fossa/stop`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptPath: script.path }),
        });

        if (!response.ok) throw new Error(`Failed to stop script: ${response.statusText}`);

        const now = new Date().toISOString();
        setScripts(prev => prev.map(s => 
          s.name === script.name ? { ...s, status: 'idle', lastRun: now } : s
        ));
        setStatus(`Stopped: ${script.name}`);
        addToast('success', `Script ${script.name} has been stopped`);
        addToHistory(script.name, 'completed', script.category);
      }
    } catch (error) {
      console.error('Script action failed:', error);
      setScripts(prev => prev.map(s => 
        s.name === script.name ? { ...s, status: 'error' } : s
      ));
      const errorMessage = error instanceof Error ? error.message : String(error);
      setStatus(`Error: ${errorMessage}`);
      addToast('error', `Script error: ${errorMessage}`);
      addToHistory(script.name, 'error', script.category, errorMessage);
    }
  };

  const addToHistory = (scriptName: string, status: 'completed' | 'error', category: string, error?: string) => {
    const newEntry: ScriptHistory = {
      timestamp: new Date().toISOString(),
      scriptName,
      status,
      category,
      duration: "Just now",
      error
    };
    setScriptHistory(prev => [newEntry, ...prev.slice(0, 19)]);
  };

  const renderDispenserSelection = () => (
    <div className="max-w-4xl mx-auto py-12">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Select Dispenser Type</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dispensers.map(dispenser => (
          <button
            key={dispenser.id}
            onClick={() => setSelectedDispenser(dispenser)}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 text-left hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  {dispenser.name}
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  {dispenser.description}
                </p>
              </div>
              <FiChevronRight className="text-gray-400" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Top Bar */}
      <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              {selectedDispenser && (
                <button
                  onClick={() => setSelectedDispenser(null)}
                  className="flex items-center space-x-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  <FiArrowLeft />
                  <span>Back</span>
                </button>
              )}
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {selectedDispenser ? selectedDispenser.name : 'Auto Fossa'}
              </h1>
              {selectedDispenser && (
                <div className="relative flex-1 max-w-lg">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search scripts..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}
            </div>
            {selectedDispenser && (
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 rounded-md ${showFilters ? 'bg-primary-100 text-primary-600' : 'text-gray-500'}`}
                  title="Show Filters"
                >
                  <FiFilter />
                </button>
                <button
                  onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
                  className="p-2 rounded-md text-gray-500"
                  title="Toggle View"
                >
                  {view === 'grid' ? <FiMaximize2 /> : <FiMinimize2 />}
                </button>
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-2 rounded-md ${showHistory ? 'bg-primary-100 text-primary-600' : 'text-gray-500'}`}
                  title="Show History"
                >
                  <FiClock />
                </button>
              </div>
            )}
          </div>

          {/* Filters Panel - Only show when dispenser is selected */}
          {selectedDispenser && showFilters && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Type
                  </label>
                  <div className="space-y-2">
                    {['gas', 'diesel', 'hybrid'].map(type => (
                      <label key={type} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.type.includes(type as any)}
                          onChange={(e) => {
                            setFilters(prev => ({
                              ...prev,
                              type: e.target.checked
                                ? [...prev.type, type as any]
                                : prev.type.filter(t => t !== type)
                            }));
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {type}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Grades
                  </label>
                  <div className="space-y-2">
                    {[3, 4, 5].map(grade => (
                      <label key={grade} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={filters.grades.includes(grade)}
                          onChange={(e) => {
                            setFilters(prev => ({
                              ...prev,
                              grades: e.target.checked
                                ? [...prev.grades, grade]
                                : prev.grades.filter(g => g !== grade)
                            }));
                          }}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          {grade} Grade
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {!selectedDispenser ? (
          renderDispenserSelection()
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Scripts Panel */}
            <div className={`${showHistory ? 'lg:col-span-3' : 'lg:col-span-4'} transition-all duration-300`}>
              {view === 'grid' ? (
                // Grid View
                <div className="space-y-6">
                  {Object.entries(groupedScripts).map(([category, scripts]) => (
                    <div key={category}>
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">{category}</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {scripts.map(script => (
                          <div
                            key={script.name}
                            className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                                    {script.name}
                                  </span>
                                  <div
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-help"
                                    title={script.description}
                                  >
                                    <FiInfo size={14} />
                                  </div>
                                </div>
                                <div className="mt-1 flex items-center space-x-2">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    script.type === 'gas' ? 'bg-green-100 text-green-800' :
                                    script.type === 'diesel' ? 'bg-blue-100 text-blue-800' :
                                    'bg-purple-100 text-purple-800'
                                  }`}>
                                    {script.type}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {script.grades} Grade
                                  </span>
                                </div>
                                {script.lastRun && (
                                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                                    Last run: {new Date(script.lastRun).toLocaleString()}
                                  </div>
                                )}
                              </div>
                              <div className="ml-4">
                                {script.status === 'error' && (
                                  <FiAlertCircle className="text-red-500" title="Last run failed" />
                                )}
                              </div>
                            </div>
                            <div className="mt-4">
                              <button
                                onClick={() => handleScriptAction(script)}
                                className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                  script.status === 'running'
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-primary-500 hover:bg-primary-600 text-white'
                                }`}
                              >
                                <span className="flex items-center justify-center space-x-2">
                                  {script.status === 'running' ? (
                                    <>
                                      <FiSquare className="animate-pulse" />
                                      <span>Stop</span>
                                    </>
                                  ) : (
                                    <>
                                      <FiPlay />
                                      <span>Run</span>
                                    </>
                                  )}
                                </span>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                // List View
                <div className="space-y-2">
                  {filteredScripts.map(script => (
                    <div
                      key={script.name}
                      className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {script.name}
                              </span>
                              <div
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-help"
                                title={script.description}
                              >
                                <FiInfo size={14} />
                              </div>
                            </div>
                            <div className="mt-1 flex items-center space-x-2">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {script.category}
                              </span>
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                script.type === 'gas' ? 'bg-green-100 text-green-800' :
                                script.type === 'diesel' ? 'bg-blue-100 text-blue-800' :
                                'bg-purple-100 text-purple-800'
                              }`}>
                                {script.type}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {script.grades} Grade
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-4">
                          {script.lastRun && (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Last run: {new Date(script.lastRun).toLocaleString()}
                            </span>
                          )}
                          <button
                            onClick={() => handleScriptAction(script)}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              script.status === 'running'
                                ? 'bg-red-500 hover:bg-red-600 text-white'
                                : 'bg-primary-500 hover:bg-primary-600 text-white'
                            }`}
                          >
                            <span className="flex items-center space-x-2">
                              {script.status === 'running' ? (
                                <>
                                  <FiSquare className="animate-pulse" />
                                  <span>Stop</span>
                                </>
                              ) : (
                                <>
                                  <FiPlay />
                                  <span>Run</span>
                                </>
                              )}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* History Panel */}
            {showHistory && (
              <div className="lg:col-span-1">
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">History</h2>
                  <div className="space-y-3">
                    {scriptHistory.map((entry, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {entry.scriptName}
                            </span>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {entry.category}
                            </div>
                            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {new Date(entry.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <span className={`text-xs font-medium ${
                            entry.status === 'completed' ? 'text-green-500' : 'text-red-500'
                          }`}>
                            {entry.status}
                          </span>
                        </div>
                        {entry.error && (
                          <div className="mt-2 text-xs text-red-500">{entry.error}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">{status}</p>
        </div>
      </div>
    </div>
  );
};

export default AutoFossa; 