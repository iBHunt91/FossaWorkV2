// This is a minimal implementation of the convert-all-users-archives script
// to allow the server to start. The archives functionality has been removed
// from the UI, but the server still imports this file.

export function convertAllUserArchives() {
  console.log(`[Archive Conversion] Bulk archive conversion is disabled`);
  return {
    success: true,
    message: "Bulk archive conversion is disabled",
    userResults: []
  };
}
