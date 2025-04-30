console.log('Starting test script');

// Add a process listener for uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught exception:', err);
});

// Add a process listener for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled rejection at:', promise, 'reason:', reason);
});

// Simple timeout to simulate async operation
setTimeout(() => {
    console.log('Async operation completed');
    console.log('Test script completed successfully');
    process.exit(0);
}, 1000); 