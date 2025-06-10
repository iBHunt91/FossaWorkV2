# Memory Audit

Analyze and optimize memory usage for resource-intensive operations.

## Execution Steps

1. Profile current memory usage across all components:
   - Node.js heap size and allocation
   - Chromium browser instances memory
   - Electron main/renderer processes
   - Windows system memory impact
2. Identify memory leaks by checking:
   - Unclosed browser contexts in Playwright
   - Orphaned event listeners in Express server
   - Large data structures in memory
   - Circular references in objects
3. Generate memory timeline:
   - Baseline memory usage
   - Peak usage during operations
   - Memory after garbage collection
   - Trend analysis over time
4. Analyze specific components:
   - Browser automation: Page objects, contexts
   - Server: Request handlers, WebSocket connections
   - Electron: IPC message queues, window objects
   - Data storage: In-memory caches, JSON parsing
5. Suggest optimizations:
   - Optimal batch sizes for form processing
   - Browser instance pooling strategies
   - Data structure improvements
   - Garbage collection tuning
6. Create detailed memory report with:
   - Component breakdown
   - Leak detection results
   - Optimization recommendations
   - Implementation priorities

## Parameters
- `component`: Specific component to audit (browser/server/electron/all)
- `duration`: Monitoring duration in minutes (default: 5)
- `--heap-snapshot`: Generate heap snapshots
- `--profile`: Create CPU and memory profiles

## Example Usage

```
/memory-audit component=browser duration=10 --heap-snapshot
```

```
/memory-audit component=all --profile
```

## Memory Optimization Strategies

### Browser Instances
- Implement page pooling
- Set page timeout limits
- Close contexts properly
- Limit concurrent browsers

### Server Memory
- Stream large responses
- Implement request queuing
- Use worker processes
- Cache strategically

### Data Handling
- Process data in chunks
- Use streams for large files
- Implement data pagination
- Clean up temporary data