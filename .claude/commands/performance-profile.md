# Performance Profile

Profile and optimize application performance across all components.

## Execution Steps

1. Profile server performance:
   - API response times
   - Database query performance
   - Middleware execution time
   - Memory usage patterns
   - CPU utilization
2. Analyze React performance:
   - Component render times
   - Re-render frequency
   - Bundle size analysis
   - Code splitting effectiveness
   - Lazy loading impact
3. Measure browser automation:
   - Page load times
   - Form fill duration
   - Screenshot capture time
   - Browser memory usage
   - Network request timing
4. Profile Electron app:
   - Startup time
   - IPC message latency
   - Window creation time
   - Memory footprint
   - Update check performance
5. Identify bottlenecks:
   - Slow API endpoints
   - Heavy computations
   - Inefficient queries
   - Large bundle chunks
   - Memory leaks
6. Generate performance metrics:
   - Flame graphs
   - Waterfall charts
   - Memory timelines
   - CPU profiles
   - Network analysis
7. Suggest optimizations:
   - Code splitting strategies
   - Lazy loading opportunities
   - Query optimization
   - Caching implementation
   - Worker thread usage
8. Create performance report:
   - Current baselines
   - Problem areas
   - Optimization plan
   - Expected improvements

## Parameters
- `area`: Specific area to profile (server/frontend/automation/electron/all)
- `duration`: Profiling duration in seconds
- `--load-test`: Simulate high load
- `--real-time`: Show real-time metrics
- `--compare`: Compare with baseline

## Example Usage

```
/performance-profile area=form-automation duration=60 --load-test
```

```
/performance-profile area=all --real-time --compare
```

## Performance Metrics

### Server Metrics
- Request/second capacity
- Average response time
- 95th percentile latency
- Error rate
- Concurrent connections

### Frontend Metrics
- First Contentful Paint
- Time to Interactive
- Largest Contentful Paint
- Total Blocking Time
- Cumulative Layout Shift

### Automation Metrics
- Form completion time
- Batch processing rate
- Error recovery time
- Resource utilization
- Queue throughput

## Optimization Strategies

### Quick Wins
- Enable compression
- Implement caching headers
- Optimize images
- Minify assets
- Remove unused code

### Advanced Optimizations
- Implement service workers
- Use Web Workers
- Database indexing
- Connection pooling
- Microservice architecture