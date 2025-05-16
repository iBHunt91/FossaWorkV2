import React, { useState, useEffect } from 'react';
import { FiX, FiInfo, FiCheckCircle, FiArrowRight, FiBookOpen } from 'react-icons/fi';

interface TutorialWelcomeModalProps {
  onClose: () => void;
}

const TutorialWelcomeModal: React.FC<TutorialWelcomeModalProps> = ({ onClose }) => {
  // Track if user has seen this modal before
  const [currentStep, setCurrentStep] = useState(1);
  const totalSteps = 4;

  useEffect(() => {
    // Add a class to the body to prevent scrolling
    document.body.classList.add('overflow-hidden');
    
    return () => {
      // Remove the class when the modal is closed
      document.body.classList.remove('overflow-hidden');
    };
  }, []);

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    } else {
      // On the last step, closing should mark as completed
      localStorage.setItem('tutorialWelcomeSeen', 'true');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 transition-opacity">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden border border-gray-200 dark:border-gray-700 transform transition-all">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <FiBookOpen className="mr-2 text-primary-500" />
            Welcome to the Tutorial Mode
          </h2>
          <button 
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 focus:outline-none"
          >
            <FiX size={24} />
          </button>
        </div>
        
        {/* Content */}
        <div className="px-6 py-5">
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-100 dark:border-primary-800">
                <h3 className="text-lg font-medium text-primary-800 dark:text-primary-300 mb-2">Welcome to Fossa Monitor Tutorial</h3>
                <p className="text-gray-700 dark:text-gray-300">
                  This tutorial mode provides a safe environment to explore and learn how to use 
                  Fossa Monitor without affecting real data. You'll find example work orders, dispensers,
                  and other data with helpful explanations.
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <span className="flex items-center justify-center h-10 w-10 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                        <FiCheckCircle size={20} />
                      </span>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-base font-medium text-gray-900 dark:text-white">Safe to Explore</h4>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        Feel free to click around and try features - your actions won't affect real data
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <span className="flex items-center justify-center h-10 w-10 rounded-md bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                        <FiInfo size={20} />
                      </span>
                    </div>
                    <div className="ml-4">
                      <h4 className="text-base font-medium text-gray-900 dark:text-white">Helpful Explanations</h4>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        Look for "Tutorial" badges and tooltips for explanations about features
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                This guided tour will help you understand the main features of Fossa Monitor.
              </p>
            </div>
          )}
          
          {currentStep === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Key Dashboard Features</h3>
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">1</span>
                  <div className="ml-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Work Orders</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">View and manage service requests</p>
                  </div>
                </div>
                
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">2</span>
                  <div className="ml-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Dispensers</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Track and manage dispensers at each location</p>
                  </div>
                </div>
                
                <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">3</span>
                  <div className="ml-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">User Preferences</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Set up notifications and configure work flows</p>
                  </div>
                </div>
                
                <div className="p-4 bg-white dark:bg-gray-800 flex items-center">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-400">4</span>
                  <div className="ml-3">
                    <h4 className="font-medium text-gray-900 dark:text-white">Form Automation</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">Automate form filling and data updates</p>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {currentStep === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Interactive Tutorial Elements</h3>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-100 dark:border-amber-700/30">
                  <h4 className="font-medium text-amber-800 dark:text-amber-300 flex items-center">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 dark:bg-amber-800 text-amber-800 dark:text-amber-300 mr-2 text-xs">
                      1
                    </span>
                    Tutorial Badges
                  </h4>
                  <p className="mt-2 text-gray-600 dark:text-gray-300 ml-8">
                    Look for <span className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200 rounded text-xs font-medium">Tutorial</span> badges 
                    that indicate example data designed to help you learn the system.
                  </p>
                </div>
                
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-700/30">
                  <h4 className="font-medium text-blue-800 dark:text-blue-300 flex items-center">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-300 mr-2 text-xs">
                      2
                    </span>
                    "Try It" Buttons
                  </h4>
                  <p className="mt-2 text-gray-600 dark:text-gray-300 ml-8">
                    Interactive <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-300 rounded text-xs font-medium">Try It</span> buttons 
                    let you practice workflows safely without affecting real data.
                  </p>
                </div>
                
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-700/30">
                  <h4 className="font-medium text-green-800 dark:text-green-300 flex items-center">
                    <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-300 mr-2 text-xs">
                      3
                    </span>
                    Reset Options
                  </h4>
                  <p className="mt-2 text-gray-600 dark:text-gray-300 ml-8">
                    Made changes you want to undo? Use the <span className="px-2 py-0.5 bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-300 rounded text-xs font-medium">Reset Tutorial Data</span> button 
                    in the Settings menu to restore the original tutorial state.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {currentStep === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Ready to Explore!</h3>
              
              <div className="p-5 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-xl border border-primary-100 dark:border-primary-700/30 text-center">
                <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-primary-100 dark:bg-primary-800/50 text-primary-600 dark:text-primary-300 mb-4">
                  <FiCheckCircle size={32} />
                </div>
                <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">You're all set!</h4>
                <p className="text-gray-600 dark:text-gray-300 max-w-md mx-auto">
                  Feel free to explore the tutorial data and features. When you're ready to use real data,
                  add a new user in the Settings area.
                </p>
                
                <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                  <button
                    onClick={() => window.open('/docs/tutorial_user.md', '_blank')}
                    className="inline-flex items-center px-4 py-2 border border-primary-300 dark:border-primary-700 text-sm font-medium rounded-md shadow-sm text-primary-700 dark:text-primary-300 bg-white dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/30"
                  >
                    <FiBookOpen className="mr-2" /> View Tutorial Guide
                  </button>
                  <button
                    onClick={onClose}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
                  >
                    Start Exploring <FiArrowRight className="ml-1" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer with step indicator */}
        <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-700/30 flex justify-between items-center">
          <div className="flex space-x-1">
            {[...Array(totalSteps)].map((_, i) => (
              <div 
                key={i}
                className={`h-2 w-2 rounded-full ${
                  i < currentStep ? 'bg-primary-500 dark:bg-primary-400' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 flex items-center"
            >
              {currentStep < totalSteps ? 'Next' : 'Get Started'}
              <FiArrowRight className="ml-1.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialWelcomeModal; 