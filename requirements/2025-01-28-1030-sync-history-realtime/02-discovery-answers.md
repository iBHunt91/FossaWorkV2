# Discovery Answers

## Q1: Is the issue that the sync history table doesn't update automatically when a sync completes (requiring page refresh)?
**Answer:** No - The issue is that history doesn't appear at all until a manual sync is initiated. It should show regardless but perhaps in a toggled closed state to reduce space.

## Q2: Should the sync history update immediately when a manual sync is triggered via the "Sync Now" button?
**Answer:** Yes - It should show something immediately so that we know it's updating, perhaps with progress update, since we won't know if it failed or was a success until it can or cannot scrape work orders.

## Q3: Is the current 10-second polling interval too slow for the desired real-time experience?
**Answer:** Yes - If it's not over complicated or over engineering, real time updates is always best.

## Q4: Should the progress indicator show more granular updates during an active sync operation?
**Answer:** Yes - Granular updates would be great, the way the progress is shown on the work order page work order scraping is perfect.

## Q5: Are there specific sync events (errors, completions) that should trigger immediate UI updates?
**Answer:** Yes - Ideally it would all be immediate so that the user knows it's working and not trying to scrape it again if there is no indication it worked or not.

## Key Insights from Answers:
1. The sync history section needs to be always visible (can be collapsed by default)
2. Immediate feedback is crucial when sync starts
3. Real-time updates are preferred over polling
4. Granular progress similar to work order page is desired
5. All events should update immediately to prevent duplicate sync attempts