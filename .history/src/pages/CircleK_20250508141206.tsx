import React, { useState, useRef, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { FiX, FiUpload, FiDownload, FiPenTool, FiDatabase, FiPlusCircle, FiTrash, FiMinus, FiPlus, FiSave } from 'react-icons/fi';

interface DispenserProduct {
  name: string;
  selected: boolean;
}

interface Dispenser {
  id: number;
  number: string; // Store as string to allow '1 / 2'
  products: DispenserProduct[];
}

// Define available products (could be fetched from API)
const AVAILABLE_PRODUCTS = [
  { name: "Regular" },
  { name: "Plus" },
  { name: "Premium" },
  { name: "Ethanol-Free" },
  { name: "Diesel" },
];

const PRODUCT_TEMPLATES: { [key: string]: string[] } = {
  regular_plus_premium: ["Regular", "Plus", "Premium"],
  regular_plus_premium_ethanol_free: ["Regular", "Plus", "Premium", "Ethanol-Free"],
  regular_plus_premium_diesel: ["Regular", "Plus", "Premium", "Diesel"],
  regular_plus_premium_ethanol_free_diesel: ["Regular", "Plus", "Premium", "Ethanol-Free", "Diesel"]
};

// Base API URL - adjust this to your actual API endpoint
const API_BASE_URL = '/api'; // or use the full URL if needed e.g. 'http://localhost:3000/api'

// Signature generator function
const generateSignature = (name: string): string => {
  // Create a canvas to generate the signature
  const canvas = document.createElement('canvas');
  canvas.width = 500; // Make canvas wider initially to handle longer names
  canvas.height = 200; // Make canvas taller to accommodate flourishes
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';
  
  // Clear the canvas with transparency instead of white
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Remove the white background fill
  // ctx.fillStyle = 'white';
  // ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Capitalize first letter of each word for more natural signature
  const formattedName = name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  // Set the signature style for a more elegant cursive
  ctx.font = 'italic 48px "Brush Script MT", "Segoe Script", cursive';
  ctx.fillStyle = 'black';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  
  // Draw the signature text
  const baselineY = 100;
  ctx.fillText(formattedName, 30, baselineY);
  
  // Find the signature bounds to crop it
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  let minX = canvas.width;
  let minY = canvas.height;
  let maxX = 0;
  let maxY = 0;
  
  // Scan the image data to find the actual signature bounds
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      // Only look for non-transparent pixels (with alpha > 0)
      if (data[idx + 3] > 0) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  // Add padding around the signature
  const padding = 20;
  minX = Math.max(0, minX - padding);
  minY = Math.max(0, minY - padding);
  maxX = Math.min(canvas.width, maxX + padding);
  maxY = Math.min(canvas.height, maxY + padding);
  
  // Calculate the size of the cropped signature
  const croppedWidth = maxX - minX;
  const croppedHeight = maxY - minY;
  
  // Create a new canvas for the cropped signature
  const croppedCanvas = document.createElement('canvas');
  croppedCanvas.width = croppedWidth;
  croppedCanvas.height = croppedHeight;
  const croppedCtx = croppedCanvas.getContext('2d');
  
  if (!croppedCtx) return canvas.toDataURL('image/png');
  
  // Draw the cropped signature
  croppedCtx.drawImage(
    canvas,
    minX, minY, croppedWidth, croppedHeight,
    0, 0, croppedWidth, croppedHeight
  );
  
  // Return the cropped signature as data URL with transparency
  return croppedCanvas.toDataURL('image/png');
};

const CircleK: React.FC = () => {
  const { addToast } = useToast();
  const [formData, setFormData] = useState({
    visit_number: '',
    store_number: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    technician_name: '',
    meter_type: 'Electronic',
    dispensers: [] as Dispenser[] // Initialize with type
  });
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [isGeneratingDocument, setIsGeneratingDocument] = useState(false);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const signatureUploadRef = useRef<HTMLInputElement>(null);
  const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
  const signatureCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSignaturePadOpen, setIsSignaturePadOpen] = useState(false);
  const [dispenserCount, setDispenserCount] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('regular_plus_premium');
  const nextDispenserId = useRef(1);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize with one dispenser only
  useEffect(() => {
    if (formData.dispensers.length === 0) {
      // Create just one dispenser by default
      const newDispenser = createNewDispenser(1);
      setFormData(prev => ({
        ...prev,
        dispensers: [newDispenser]
      }));
    }
  }, [formData.dispensers.length]);

  useEffect(() => {
    if (isSignaturePadOpen && signatureCanvasRef.current) {
      const canvas = signatureCanvasRef.current;
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.strokeStyle = '#000000';
        // Clear with transparency
        context.clearRect(0, 0, canvas.width, canvas.height);
        signatureCtxRef.current = context;
      }
    }
  }, [isSignaturePadOpen]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!signatureCtxRef.current) return;
    
    setIsDrawing(true);
    const ctx = signatureCtxRef.current;
    
    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rect = signatureCanvasRef.current!.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(clientX - rect.left, clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !signatureCtxRef.current) return;
    
    const ctx = signatureCtxRef.current;
    
    let clientX, clientY;
    if ('touches' in e) {
      e.preventDefault(); // Prevent scrolling on touch devices
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const rect = signatureCanvasRef.current!.getBoundingClientRect();
    ctx.lineTo(clientX - rect.left, clientY - rect.top);
    ctx.stroke();
  };

  const endDrawing = () => {
    if (signatureCtxRef.current) {
      signatureCtxRef.current.closePath();
      setIsDrawing(false);
      
      // Save the signature with transparency
      if (signatureCanvasRef.current) {
        // Get the original canvas data
        const canvas = signatureCanvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Create a new temporary canvas for the transparent version
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) return;

        // Get the signature data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        // Convert white pixels to transparent
        // Only keep the actual signature
        for (let i = 0; i < imageData.data.length; i += 4) {
          // If it's a white or light pixel (background)
          if (imageData.data[i] > 240 && imageData.data[i + 1] > 240 && imageData.data[i + 2] > 240) {
            // Make it fully transparent
            imageData.data[i + 3] = 0;
          }
        }
        
        // Put the modified image data on the temporary canvas
        tempCtx.putImageData(imageData, 0, 0);
        
        // Save the transparent signature
        const dataUrl = tempCanvas.toDataURL('image/png');
        setSignatureImage(dataUrl);
      }
    }
  };

  const clearSignature = () => {
    if (signatureCanvasRef.current && signatureCtxRef.current) {
      signatureCtxRef.current.clearRect(
        0, 0, 
        signatureCanvasRef.current.width, 
        signatureCanvasRef.current.height
      );
      setSignatureImage(null);
    }
  };

  const closeSignaturePad = () => {
    setIsSignaturePadOpen(false);
  };

  const openSignaturePad = () => {
    setIsSignaturePadOpen(true);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result !== 'string') return;
      
      // Create an image from the uploaded file
      const img = new Image();
      img.onload = () => {
        // Create a canvas to process the image
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Draw the image onto the canvas
        ctx.drawImage(img, 0, 0);
        
        // Get the image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Make white/light background transparent
        for (let i = 0; i < data.length; i += 4) {
          // If it's a white or light pixel (background)
          if (data[i] > 240 && data[i+1] > 240 && data[i+2] > 240) {
            // Make it transparent
            data[i+3] = 0;
          }
        }
        
        // Put the modified image data back to the canvas
        ctx.putImageData(imageData, 0, 0);
        
        // Convert to data URL and set as signature
        const dataUrl = canvas.toDataURL('image/png');
        setSignatureImage(dataUrl);
        addToast('success', 'Signature uploaded', 3000);
      };
      
      // Load the image from the file reader result
      img.src = event.target.result as string;
    };
    
    reader.readAsDataURL(file);
  };

  const createNewDispenser = (number: number): Dispenser => {
    const currentNumber = number * 2 - 1;
    const nextNumber = number * 2;
    return {
      id: nextDispenserId.current++,
      number: `${currentNumber} / ${nextNumber}`,
      products: AVAILABLE_PRODUCTS.map(p => ({ name: p.name, selected: false }))
    };
  };

  const addDispenser = () => {
    const newDispenser = createNewDispenser(formData.dispensers.length + 1);
    setFormData(prev => ({
      ...prev,
      dispensers: [...prev.dispensers, newDispenser]
    }));
    setDispenserCount(prev => prev + 1);
  };

  const decrementDispenserCount = () => {
    if (dispenserCount > 1) {
      setDispenserCount(prevCount => prevCount - 1);
      setFormData(prev => ({
        ...prev,
        dispensers: prev.dispensers.slice(0, dispenserCount - 1)
      }));
    }
  };

  const incrementDispenserCount = () => {
    setDispenserCount(prevCount => prevCount + 1);
    addDispenser();
  };

  const handleDispenserCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let count = parseInt(e.target.value, 10);
    if (isNaN(count) || count < 1) {
      count = 1;
    }
    setDispenserCount(count);
  };

  const applyDispenserCount = () => {
    const currentCount = formData.dispensers.length;
    if (dispenserCount > currentCount) {
      const diff = dispenserCount - currentCount;
      const newDispensers = Array.from({ length: diff }, (_, i) => createNewDispenser(currentCount + i + 1));
      setFormData(prev => ({ ...prev, dispensers: [...prev.dispensers, ...newDispensers] }));
    } else if (dispenserCount < currentCount) {
      setFormData(prev => ({ ...prev, dispensers: prev.dispensers.slice(0, dispenserCount) }));
    }
    // No change if counts are equal
  };

  const removeDispenser = (idToRemove: number) => {
    setFormData(prev => ({
      ...prev,
      dispensers: prev.dispensers
        .filter(d => d.id !== idToRemove)
        .map((d, index) => ({ // Renumber dispensers
          ...d,
          number: `${index * 2 + 1} / ${index * 2 + 2}`
        }))
    }));
    // Update dispenser count input to match actual count
    setDispenserCount(prevCount => Math.max(1, prevCount - 1));
  };

  const handleDispenserNumberChange = (id: number, newNumber: string) => {
    setFormData(prev => ({
      ...prev,
      dispensers: prev.dispensers.map(d =>
        d.id === id ? { ...d, number: newNumber } : d
      )
    }));
  };

  const toggleProductSelection = (dispenserId: number, productName: string) => {
    setFormData(prev => ({
      ...prev,
      dispensers: prev.dispensers.map(dispenser =>
        dispenser.id === dispenserId
          ? {
              ...dispenser,
              products: dispenser.products.map(product =>
                product.name === productName
                  ? { ...product, selected: !product.selected }
                  : product
              )
            }
          : dispenser
      )
    }));
  };

  const applyTemplateToDispenser = (dispenserId: number, templateKey: string) => {
    const productsToSelect = PRODUCT_TEMPLATES[templateKey] || [];
    setFormData(prev => ({
      ...prev,
      dispensers: prev.dispensers.map(dispenser =>
        dispenser.id === dispenserId
          ? {
              ...dispenser,
              products: dispenser.products.map(product => ({
                ...product,
                selected: productsToSelect.includes(product.name)
              }))
            }
          : dispenser
      )
    }));
  };

  const applyTemplateToAll = () => {
    const templateKey = selectedTemplate;
    const productsToSelect = PRODUCT_TEMPLATES[templateKey] || [];
    setFormData(prev => ({
      ...prev,
      dispensers: prev.dispensers.map(dispenser => ({
        ...dispenser,
        products: dispenser.products.map(product => ({
          ...product,
          selected: productsToSelect.includes(product.name)
        }))
      }))
    }));
  };

  const handleStoreNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setFormData(prev => ({ ...prev, store_number: value }));
    
    if (value.trim()) {
      setIsLoading(true);
      try {
        const response = await fetch(`${API_BASE_URL}/circle-k/store-data`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ store_number: value }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setFormData(prev => ({
            ...prev,
            address: data.address || '',
            city: data.city || '',
            state: data.state || '',
            zip: data.zip || ''
          }));
          addToast('success', 'Store data loaded successfully', 3000);
        } else {
          addToast('warning', 'Store not found. Please enter address manually.', 5000);
        }
      } catch (error) {
        console.error('Error fetching store data:', error);
        addToast('error', 'Failed to fetch store data. Server may be unavailable.', 5000);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    
    // Clear error for this field if it exists
    if (errors[id]) {
      setErrors(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleRadioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, meter_type: e.target.value }));
  };

  const validateForm = () => {
    const newErrors: Record<string, boolean> = {};
    const requiredFields = ['store_number', 'address', 'city', 'state', 'zip', 'technician_name'];
    
    requiredFields.forEach(field => {
      if (!formData[field as keyof typeof formData]) {
        newErrors[field] = true;
      }
    });
    
    if (!signatureImage) {
      newErrors.signature = true;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      addToast('error', 'Please fill in all required fields', 5000);
      document.getElementById('errorAlert')?.classList.remove('hidden');
      return;
    }
    
    setIsGeneratingDocument(true);
    
    try {
      // Filter dispenser data for submission
      const dispensersForSubmit = formData.dispensers.map(d => ({
        number: d.number,
        products: d.products.filter(p => p.selected).map(p => p.name)
      }));
      
      const submitData = {
        ...formData,
        dispensers: dispensersForSubmit, // Use filtered data
        signature_image: signatureImage
      };
      
      const response = await fetch(`${API_BASE_URL}/circle-k/generate-document`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      });
      
      // First check the content type to determine how to handle the response
      const contentType = response.headers.get('content-type');
      
      if (response.ok) {
        if (contentType && contentType.includes('application/json')) {
          // Handle JSON response (usually status messages or errors)
          const jsonData = await response.json();
          
          if (jsonData.success) {
            // If this is a success message but document generation isn't available yet
            addToast('info', jsonData.message || 'Document generation acknowledged', 5000);
            
            // Optional: You could save the JSON data for debugging
            const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
            const url = window.URL.createObjectURL(jsonBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            const locationNumber = formData.store_number || 'unknown';
            a.download = `Circle K #${locationNumber}-debug.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
          } else {
            throw new Error(jsonData.error || 'Unknown error in document generation');
          }
        } else {
          // Handle binary document response (actual Word document)
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.style.display = 'none';
          a.href = url;
          // Use location number in the filename
          const locationNumber = formData.store_number || 'unknown';
          a.download = `Circle K #${locationNumber}.docx`;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          addToast('success', 'Document generated successfully!', 5000);
        }
      } else {
        // Handle error responses
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || 'Failed to generate document';
        } catch (e) {
          errorMessage = `Server error (${response.status})`;
        }
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error generating document:', error);
      addToast('error', `Error: ${error instanceof Error ? error.message : 'Failed to generate document'}`, 5000);
    } finally {
      setIsGeneratingDocument(false);
    }
  };

  // Function to download the signature as an image
  const downloadSignature = () => {
    if (!signatureImage) {
      addToast('error', 'No signature to download', 3000);
      return;
    }
    
    const a = document.createElement('a');
    a.href = signatureImage;
    a.download = `signature-${formData.technician_name || 'untitled'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    addToast('success', 'Signature downloaded', 3000);
  };
  
  // Function to generate a signature based on technician name
  const handleGenerateSignature = () => {
    if (!formData.technician_name) {
      addToast('error', 'Please enter technician name first', 3000);
      return;
    }
    
    const generatedSig = generateSignature(formData.technician_name);
    setSignatureImage(generatedSig);
    addToast('success', 'Signature generated', 3000);
  };

  return (
    <div className="h-full max-w-full overflow-x-hidden animate-fadeIn px-4 py-6">
      <div className="bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6 mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-6 border-b pb-2">Circle K Report Generator</h1>
        
        {/* Error Alert */}
        <div id="errorAlert" className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4 hidden" role="alert">
          <strong className="font-bold">Please correct the errors below before submitting.</strong>
          <button type="button" className="absolute top-0 right-0 px-4 py-3" onClick={() => document.getElementById('errorAlert')?.classList.add('hidden')}>
            <FiX className="h-4 w-4" />
          </button>
        </div>
        
        <form id="documentForm" onSubmit={handleFormSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Store Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="bg-indigo-600 dark:bg-indigo-700 text-white px-4 py-3">
                <h2 className="text-lg font-semibold">Store Information</h2>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <label htmlFor="visit_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Visit Number</label>
                  <input type="text" id="visit_number" value={formData.visit_number} onChange={handleInputChange} className={`mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white shadow-sm focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 text-sm`} />
                </div>
                
                <div className="mb-4 relative">
                  <label htmlFor="store_number" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Location Number <span className="text-red-500">*</span>
                  </label>
                  <div className="flex items-center">
                    <input 
                      type="text" 
                      id="store_number" 
                      value={formData.store_number} 
                      onChange={handleStoreNumberChange} 
                      className={`block w-full rounded-md ${errors.store_number ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'} dark:bg-gray-700 dark:text-white shadow-sm px-3 py-2 text-sm`} 
                      placeholder="Enter store number" 
                    />
                    {isLoading && (
                      <div className="absolute right-3 top-[37px]">
                        <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.store_number && <p className="mt-1 text-sm text-red-500">Location Number is required</p>}
                </div>
                
                <div className="mb-4">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Address <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    id="address" 
                    value={formData.address} 
                    onChange={handleInputChange} 
                    className={`mt-1 block w-full rounded-md ${errors.address ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'} dark:bg-gray-700 dark:text-white shadow-sm px-3 py-2 text-sm`} 
                  />
                  {errors.address && <p className="mt-1 text-sm text-red-500">Address is required</p>}
                </div>
                
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-6 mb-4">
                    <label htmlFor="city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      City <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      id="city" 
                      value={formData.city} 
                      onChange={handleInputChange} 
                      className={`mt-1 block w-full rounded-md ${errors.city ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'} dark:bg-gray-700 dark:text-white shadow-sm px-3 py-2 text-sm`} 
                    />
                    {errors.city && <p className="mt-1 text-sm text-red-500">City is required</p>}
                  </div>
                  
                  <div className="col-span-2 mb-4">
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      State <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      id="state" 
                      value={formData.state} 
                      onChange={handleInputChange} 
                      className={`mt-1 block w-full rounded-md ${errors.state ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'} dark:bg-gray-700 dark:text-white shadow-sm px-3 py-2 text-sm`} 
                    />
                    {errors.state && <p className="mt-1 text-sm text-red-500">State is required</p>}
                  </div>
                  
                  <div className="col-span-4 mb-4">
                    <label htmlFor="zip" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      ZIP <span className="text-red-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      id="zip" 
                      value={formData.zip} 
                      onChange={handleInputChange} 
                      className={`mt-1 block w-full rounded-md ${errors.zip ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'} dark:bg-gray-700 dark:text-white shadow-sm px-3 py-2 text-sm`} 
                    />
                    {errors.zip && <p className="mt-1 text-sm text-red-500">ZIP is required</p>}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Technician Information */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
              <div className="bg-indigo-600 dark:bg-indigo-700 text-white px-4 py-3">
                <h2 className="text-lg font-semibold">Technician Information</h2>
              </div>
              <div className="p-5">
                <div className="mb-4">
                  <label htmlFor="technician_name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Technician Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    id="technician_name" 
                    value={formData.technician_name} 
                    onChange={handleInputChange} 
                    className={`mt-1 block w-full rounded-md ${errors.technician_name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500'} dark:bg-gray-700 dark:text-white shadow-sm px-3 py-2 text-sm`} 
                  />
                  {errors.technician_name && <p className="mt-1 text-sm text-red-500">Technician Name is required</p>}
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Signature <span className="text-red-500">*</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={openSignaturePad}
                      className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors duration-150 text-sm"
                    >
                      <FiPenTool className="mr-2" /> Draw Signature
                    </button>
                    <button
                      type="button"
                      onClick={() => signatureUploadRef.current?.click()}
                      className="flex items-center px-3 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors duration-150 text-sm"
                    >
                      <FiUpload className="mr-2" /> Upload Signature
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateSignature}
                      className="flex items-center px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors duration-150 text-sm"
                    >
                      <FiPenTool className="mr-2" /> Generate Signature
                    </button>
                    <input
                      type="file"
                      ref={signatureUploadRef}
                      onChange={handleSignatureUpload}
                      className="hidden"
                      accept="image/*"
                    />
                  </div>
                  
                  {errors.signature && !signatureImage && (
                    <p className="mt-1 text-sm text-red-500">Signature is required</p>
                  )}
                  
                  {signatureImage && (
                    <div className="mt-3 border border-gray-300 dark:border-gray-600 rounded p-2 bg-white">
                      <img src={signatureImage} alt="Signature" className="max-h-20 max-w-full mx-auto" />
                      <div className="mt-2 flex space-x-2">
                        <button
                          type="button"
                          onClick={() => setSignatureImage(null)}
                          className="text-red-600 hover:text-red-800 text-sm flex items-center"
                        >
                          <FiX className="mr-1" /> Remove
                        </button>
                        <button
                          type="button"
                          onClick={downloadSignature}
                          className="text-indigo-600 hover:text-indigo-800 text-sm flex items-center"
                        >
                          <FiSave className="mr-1" /> Save Signature
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Meter Type</label>
                  <div className="flex space-x-4">
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        name="meter_type"
                        value="Electronic"
                        checked={formData.meter_type === 'Electronic'}
                        onChange={handleRadioChange}
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">Electronic</span>
                    </label>
                    <label className="inline-flex items-center">
                      <input
                        type="radio"
                        className="form-radio h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                        name="meter_type"
                        value="HD"
                        checked={formData.meter_type === 'HD'}
                        onChange={handleRadioChange}
                      />
                      <span className="ml-2 text-gray-700 dark:text-gray-300">HD</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* --- Dispenser Information Section --- */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
            <div className="bg-indigo-600 dark:bg-indigo-700 text-white px-4 py-3">
              <h2 className="text-lg font-semibold flex items-center"><FiDatabase className="mr-2"/> Dispenser Information</h2>
            </div>
            <div className="p-5">
              {/* Dispenser Controls */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label htmlFor="dispenserCountInput" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Number of Dispensers</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                    <button
                      type="button"
                      onClick={decrementDispenserCount}
                      className="inline-flex items-center justify-center px-3 py-2 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      disabled={dispenserCount <= 1}
                    >
                      <FiMinus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      id="dispenserCountInput"
                      min="1"
                      value={dispenserCount}
                      onChange={handleDispenserCountChange}
                      className="flex-1 block w-16 min-w-0 text-center border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
                    />
                    <button
                      type="button"
                      onClick={incrementDispenserCount}
                      className="inline-flex items-center justify-center px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <FiPlus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="productTemplateSelect" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Template</label>
                  <div className="mt-1 flex rounded-md shadow-sm">
                     <select
                        id="productTemplateSelect"
                        value={selectedTemplate}
                        onChange={(e) => setSelectedTemplate(e.target.value)}
                        className="flex-1 block w-full rounded-l-md border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500 px-3 py-2 text-sm"
                      >
                        {Object.entries(PRODUCT_TEMPLATES).map(([key, products]) => (
                          <option key={key} value={key}>{products.join(', ')}</option>
                        ))}
                      </select>
                    <button
                      type="button"
                      onClick={applyTemplateToAll}
                      className="inline-flex items-center px-3 py-2 border border-l-0 border-gray-300 dark:border-gray-600 rounded-r-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm transition-colors"
                    >
                      Apply to All
                    </button>
                  </div>
                </div>
                <div className="flex items-end">
                   <button
                      type="button"
                      onClick={addDispenser}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
                    >
                      <FiPlusCircle className="mr-2" /> Add Dispenser
                    </button>
                </div>
              </div>

              {/* Individual Dispensers */}
              <div className="space-y-4">
                {formData.dispensers.map((dispenser) => (
                  <div key={dispenser.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-indigo-300 dark:hover:border-indigo-500 transition-colors">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Dispenser</span>
                        {/* Improved text input for dispenser number */}
                        <input 
                          type="text"
                          value={dispenser.number}
                          onChange={(e) => handleDispenserNumberChange(dispenser.id, e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm w-24 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                         <button
                           type="button"
                           onClick={() => applyTemplateToDispenser(dispenser.id, selectedTemplate)}
                           className="mr-2 inline-flex items-center px-2.5 py-1.5 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-500 hover:bg-indigo-600 transition-colors"
                         >
                           Apply Template
                         </button>
                        <button
                          type="button"
                          onClick={() => removeDispenser(dispenser.id)}
                          className="text-red-500 hover:text-red-700 p-1.5 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                          aria-label="Remove dispenser"
                        >
                          <FiTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                      {dispenser.products.map((product) => (
                        <button
                          key={product.name}
                          type="button"
                          onClick={() => toggleProductSelection(dispenser.id, product.name)}
                          className={`px-3 py-2 border rounded-md text-sm text-center transition-colors duration-150 ${product.selected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'}`}
                        >
                          {product.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* --- End Dispenser Information Section --- */}
          
          {/* Submit Button */}
          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              type="submit"
              disabled={isGeneratingDocument}
              className={`flex-1 flex justify-center items-center px-4 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors ${isGeneratingDocument ? 'opacity-75 cursor-not-allowed' : ''}`}
            >
              {isGeneratingDocument ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating Document...
                </>
              ) : (
                <>
                  <FiDownload className="mr-2" /> Generate Document
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormData({
                  visit_number: '',
                  store_number: '',
                  address: '',
                  city: '',
                  state: '',
                  zip: '',
                  technician_name: '',
                  meter_type: 'Electronic',
                  dispensers: []
                });
                setSignatureImage(null);
                setErrors({});
                setDispenserCount(1);
                addDispenser();
              }}
              className="flex-1 flex justify-center items-center px-4 py-3 border border-gray-300 shadow-sm text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors dark:bg-gray-700 dark:text-white dark:border-gray-600 dark:hover:bg-gray-600"
            >
              Clear All
            </button>
          </div>
        </form>
      </div>
      
      {/* Signature Pad Modal */}
      {isSignaturePadOpen && (
        <div className="fixed inset-0 z-50 overflow-auto flex items-center justify-center bg-black bg-opacity-75">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-lg mx-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Draw Your Signature</h3>
              <button onClick={closeSignaturePad} className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            
            <div className="border-2 border-gray-300 dark:border-gray-600 rounded" style={{ backgroundColor: '#f0f0f0' }}>
              <canvas
                ref={signatureCanvasRef}
                className="w-full h-64 touch-none"
                style={{ backgroundColor: 'transparent' }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={endDrawing}
                onMouseLeave={endDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={endDrawing}
              ></canvas>
            </div>
            
            <div className="flex justify-between mt-4">
              <button
                onClick={clearSignature}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                Clear
              </button>
              <div className="space-x-2">
                <button
                  onClick={downloadSignature}
                  className="px-4 py-2 bg-green-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <FiSave className="inline mr-1" /> Save Image
                </button>
                <button
                  onClick={closeSignaturePad}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-indigo-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Use Signature
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CircleK; 