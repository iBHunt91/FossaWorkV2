$sourceFilePath = "src\pages\FormPrep.tsx"
$endingFilePath = "FormPrepEnding.txt"
$backupFilePath = "src\pages\FormPrep.tsx.bak"
$targetLine = 3330  # Line before which to truncate

# Create backup
Copy-Item -Path $sourceFilePath -Destination $backupFilePath -Force

# Read the file up to the target line
$fileContent = Get-Content -Path $sourceFilePath -TotalCount $targetLine

# Read the ending correction
$endingContent = Get-Content -Path $endingFilePath

# Combine the truncated file with the corrected ending
$newContent = $fileContent + $endingContent

# Write the new content to the original file
Set-Content -Path $sourceFilePath -Value $newContent

Write-Host "File has been successfully patched." 