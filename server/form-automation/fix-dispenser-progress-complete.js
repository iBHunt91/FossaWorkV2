// This is a collection of changes needed to fix dispenserProgress initialization

// 1. Add dispenserProgress initialization after line 2974 (after let serviceCode = null;)
// Add:
    let dispenserProgress = {
      workOrderId: null,
      dispensers: []
    };

// 2. Set the workOrderId when we have it (after line 3117)
// After the line: logger.info(`Final work order ID for lookup: ${workOrderIdFromUrl}`);
// Add:
    // Set work order ID in dispenserProgress
    if (workOrderIdFromUrl) {
      dispenserProgress.workOrderId = workOrderIdFromUrl;
    }

// 3. Update the initial updateStatus call to include dispenserProgress
// Change line 2914: updateStatus('running', `Processing visit: ${visitUrl}`);
// To:
    updateStatus('running', `Processing visit: ${visitUrl}`, null, dispenserProgress);

// 4. Update fillFormDetails call in prepareFormsForDispensers to pass dispenserProgress
// Change line that looks like:
// await fillFormDetails(page, formUrls, dispensers, isSpecificDispensers, formType);
// To:
    await fillFormDetails(page, formUrls, dispensers, isSpecificDispensers, formType, dispenserProgress);

// 5. Update all updateStatus calls to include dispenserProgress
// Example changes:
    updateStatus('running', 'Analyzing visit details...', null, dispenserProgress);
    updateStatus('completed', `Visit processed successfully. Created ${formUrls.length} forms.`, null, dispenserProgress);
    updateStatus('error', `Error processing visit: ${error.message}`, null, dispenserProgress);