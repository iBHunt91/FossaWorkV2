import React from 'react';
import { ToastProvider } from '../context/ToastContext';
import { ThemeProvider } from '../context/ThemeContext';
import FormPrepFixed from './FormPrepFixed';

/**
 * Wrapper component for FormPrep to ensure proper context providers
 * and clean structure
 */
const FormPrepWrapper: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <FormPrepFixed />
      </ToastProvider>
    </ThemeProvider>
  );
};

export default FormPrepWrapper;
