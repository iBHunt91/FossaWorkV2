# Monitor Command

**What it does:** Watches system metrics in real-time to help identify performance issues or problems.

**When to use it:**
- When the system feels slow
- To track API response times
- During heavy batch processing
- To find memory leaks

**How to use it:**
- `/monitor performance` - Overall system performance
- `/monitor api` - API endpoint response times
- `/monitor scraping` - Scraping success rates

**Example scenario:** Users report the system is running slowly. Type `/monitor performance` and Claude will show you CPU usage, memory consumption, slow database queries, and identify what's causing the bottleneck.

**Metrics Available:**
- `performance` - CPU, memory, disk I/O
- `memory` - Memory usage and leaks
- `api` - Response times, error rates
- `errors` - Error frequency and types
- `scraping` - Success rates, failures

**What you'll see:**
- 📊 Real-time graphs and metrics
- 🚨 Alerts for anomalies
- 📈 Trends over time
- 💡 Optimization suggestions

---

## Arguments

- `metric` (required): What metric to monitor

## Content

I'll monitor {{metric}} metrics for the system.

<task>
1. Start {{metric}} monitoring with appropriate tools
2. Collect real-time metrics for analysis
3. Display current values and trends
4. Identify anomalies or concerning patterns
5. Compare against normal baselines
6. Generate visualizations if applicable
7. Suggest specific optimizations based on data
8. Create monitoring report
</task>