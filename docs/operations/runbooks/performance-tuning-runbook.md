# Performance Tuning Runbook

## Overview

This runbook provides comprehensive procedures for monitoring, analyzing, and optimizing the performance of FossaWork V2. It covers database optimization, application tuning, infrastructure scaling, and proactive performance management.

## Performance Monitoring Framework

### Key Performance Indicators (KPIs)

**Response Time Metrics:**
```yaml
API Endpoints:
  Target: < 500ms (95th percentile)
  Warning: 500ms - 2s
  Critical: > 2s

Database Queries:
  Target: < 100ms (average)
  Warning: 100ms - 500ms
  Critical: > 500ms

Page Load Times:
  Target: < 2s (complete load)
  Warning: 2s - 5s
  Critical: > 5s

Form Automation:
  Target: < 30s per form
  Warning: 30s - 60s
  Critical: > 60s
```

**Throughput Metrics:**
```yaml
Concurrent Users:
  Target: 50+ simultaneous users
  Warning: Performance degradation at 40+
  Critical: System failure at 60+

Requests per Second:
  Target: 100+ RPS
  Warning: < 50 RPS
  Critical: < 10 RPS

Work Order Processing:
  Target: 100+ per hour
  Warning: 50-100 per hour
  Critical: < 50 per hour
```

**Resource Utilization:**
```yaml
CPU Usage:
  Target: < 60%
  Warning: 60-80%
  Critical: > 80%

Memory Usage:
  Target: < 70%
  Warning: 70-85%
  Critical: > 85%

Disk I/O:
  Target: < 70% utilization
  Warning: 70-85%
  Critical: > 85%
```

### Performance Monitoring Tools

**Continuous Performance Monitoring:**
```python
#!/usr/bin/env python3
# /tools/operations/performance-monitor.py

import psutil
import requests
import sqlite3
import time
import json
from datetime import datetime
from statistics import mean, median

class PerformanceMonitor:
    def __init__(self):
        self.metrics_history = []
        self.alert_thresholds = {
            'api_response_time': 2.0,
            'cpu_usage': 80.0,
            'memory_usage': 85.0,
            'disk_usage': 85.0
        }
    
    def collect_system_metrics(self):
        """Collect system resource metrics"""
        return {
            'cpu_percent': psutil.cpu_percent(interval=1),
            'memory_percent': psutil.virtual_memory().percent,
            'disk_percent': psutil.disk_usage('/').percent,
            'network_io': psutil.net_io_counters()._asdict(),
            'process_count': len(psutil.pids()),
            'load_avg': psutil.getloadavg() if hasattr(psutil, 'getloadavg') else None
        }
    
    def test_api_performance(self):
        """Test API endpoint performance"""
        endpoints = [
            'http://localhost:8000/api/health',
            'http://localhost:8000/api/auth/validate',
            'http://localhost:8000/api/work-orders',
            'http://localhost:8000/api/dispensers'
        ]
        
        results = {}
        for endpoint in endpoints:
            try:
                start_time = time.time()
                response = requests.get(endpoint, timeout=10)
                response_time = time.time() - start_time
                
                results[endpoint] = {
                    'response_time': response_time,
                    'status_code': response.status_code,
                    'success': response.status_code == 200
                }
            except Exception as e:
                results[endpoint] = {
                    'response_time': None,
                    'status_code': None,
                    'success': False,
                    'error': str(e)
                }
        
        return results
    
    def test_database_performance(self):
        """Test database query performance"""
        try:
            conn = sqlite3.connect('/backend/fossawork_v2.db')
            cursor = conn.cursor()
            
            # Test queries
            queries = [
                'SELECT COUNT(*) FROM work_orders',
                'SELECT COUNT(*) FROM dispensers',
                'SELECT * FROM work_orders ORDER BY created_date DESC LIMIT 10'
            ]
            
            results = {}
            for query in queries:
                start_time = time.time()
                cursor.execute(query)
                cursor.fetchall()
                query_time = time.time() - start_time
                
                results[query] = {
                    'execution_time': query_time,
                    'success': True
                }
            
            conn.close()
            return results
            
        except Exception as e:
            return {'error': str(e)}
    
    def analyze_performance_trends(self):
        """Analyze performance trends from historical data"""
        if len(self.metrics_history) < 10:
            return {'status': 'insufficient_data'}
        
        recent_metrics = self.metrics_history[-10:]
        
        # Calculate trends
        cpu_trend = [m['system']['cpu_percent'] for m in recent_metrics]
        memory_trend = [m['system']['memory_percent'] for m in recent_metrics]
        api_response_trends = []
        
        for metrics in recent_metrics:
            if 'api' in metrics:
                api_times = [r['response_time'] for r in metrics['api'].values() 
                           if r['response_time'] is not None]
                if api_times:
                    api_response_trends.append(mean(api_times))
        
        return {
            'cpu_trend': {
                'average': mean(cpu_trend),
                'median': median(cpu_trend),
                'max': max(cpu_trend),
                'increasing': cpu_trend[-1] > cpu_trend[0]
            },
            'memory_trend': {
                'average': mean(memory_trend),
                'median': median(memory_trend),
                'max': max(memory_trend),
                'increasing': memory_trend[-1] > memory_trend[0]
            },
            'api_response_trend': {
                'average': mean(api_response_trends) if api_response_trends else None,
                'increasing': (api_response_trends[-1] > api_response_trends[0] 
                              if len(api_response_trends) >= 2 else False)
            }
        }
    
    def check_alert_conditions(self, metrics):
        """Check if any metrics exceed alert thresholds"""
        alerts = []
        
        # System resource alerts
        if metrics['system']['cpu_percent'] > self.alert_thresholds['cpu_usage']:
            alerts.append(f"High CPU usage: {metrics['system']['cpu_percent']:.1f}%")
        
        if metrics['system']['memory_percent'] > self.alert_thresholds['memory_usage']:
            alerts.append(f"High memory usage: {metrics['system']['memory_percent']:.1f}%")
        
        if metrics['system']['disk_percent'] > self.alert_thresholds['disk_usage']:
            alerts.append(f"High disk usage: {metrics['system']['disk_percent']:.1f}%")
        
        # API performance alerts
        if 'api' in metrics:
            for endpoint, result in metrics['api'].items():
                if (result['response_time'] and 
                    result['response_time'] > self.alert_thresholds['api_response_time']):
                    alerts.append(f"Slow API response: {endpoint} ({result['response_time']:.2f}s)")
        
        return alerts
    
    def run_monitoring_cycle(self):
        """Run a complete monitoring cycle"""
        timestamp = datetime.utcnow().isoformat()
        
        # Collect all metrics
        metrics = {
            'timestamp': timestamp,
            'system': self.collect_system_metrics(),
            'api': self.test_api_performance(),
            'database': self.test_database_performance()
        }
        
        # Store metrics
        self.metrics_history.append(metrics)
        
        # Keep only last 100 entries
        if len(self.metrics_history) > 100:
            self.metrics_history = self.metrics_history[-100:]
        
        # Check for alerts
        alerts = self.check_alert_conditions(metrics)
        
        # Log metrics
        with open('/logs/performance-metrics.jsonl', 'a') as f:
            f.write(json.dumps(metrics) + '\n')
        
        # Log alerts if any
        if alerts:
            alert_data = {
                'timestamp': timestamp,
                'alerts': alerts,
                'severity': 'high'
            }
            with open('/logs/performance-alerts.jsonl', 'a') as f:
                f.write(json.dumps(alert_data) + '\n')
            
            print(f"PERFORMANCE ALERTS: {len(alerts)} issues detected")
            for alert in alerts:
                print(f"  - {alert}")
        
        return metrics, alerts

def main():
    monitor = PerformanceMonitor()
    
    # Run single monitoring cycle
    metrics, alerts = monitor.run_monitoring_cycle()
    
    print(f"Performance monitoring completed at {metrics['timestamp']}")
    print(f"CPU: {metrics['system']['cpu_percent']:.1f}%")
    print(f"Memory: {metrics['system']['memory_percent']:.1f}%")
    print(f"Disk: {metrics['system']['disk_percent']:.1f}%")
    
    if alerts:
        print(f"\n{len(alerts)} performance alerts generated")
    else:
        print("\nNo performance issues detected")

if __name__ == '__main__':
    main()
```

## Database Performance Optimization

### Query Optimization

**Database Performance Analysis:**
```python
#!/usr/bin/env python3
# /tools/operations/analyze-database-performance.py

import sqlite3
import time
import json
from datetime import datetime

class DatabasePerformanceAnalyzer:
    def __init__(self, db_path='/backend/fossawork_v2.db'):
        self.db_path = db_path
    
    def analyze_slow_queries(self):
        """Identify and analyze slow queries"""
        conn = sqlite3.connect(self.db_path)
        conn.execute('PRAGMA query_only = ON')
        
        # Test common queries
        test_queries = [
            'SELECT COUNT(*) FROM work_orders',
            'SELECT * FROM work_orders ORDER BY created_date DESC LIMIT 100',
            'SELECT * FROM dispensers WHERE customer_id = 1',
            'SELECT wo.*, d.* FROM work_orders wo JOIN dispensers d ON wo.customer_id = d.customer_id',
            'SELECT * FROM work_orders WHERE service_code = "2861"',
            'SELECT COUNT(*) FROM work_orders WHERE created_date > date("now", "-30 days")'
        ]
        
        results = []
        for query in test_queries:
            start_time = time.time()
            try:
                cursor = conn.execute(query)
                cursor.fetchall()
                execution_time = time.time() - start_time
                
                results.append({
                    'query': query,
                    'execution_time': execution_time,
                    'status': 'success'
                })
            except Exception as e:
                results.append({
                    'query': query,
                    'execution_time': None,
                    'status': 'error',
                    'error': str(e)
                })
        
        conn.close()
        return results
    
    def analyze_table_statistics(self):
        """Analyze table sizes and statistics"""
        conn = sqlite3.connect(self.db_path)
        
        # Get table information
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row[0] for row in cursor.fetchall()]
        
        table_stats = {}
        for table in tables:
            try:
                # Row count
                cursor = conn.execute(f'SELECT COUNT(*) FROM {table}')
                row_count = cursor.fetchone()[0]
                
                # Table size (approximate)
                cursor = conn.execute(f'PRAGMA table_info({table})')
                columns = cursor.fetchall()
                
                table_stats[table] = {
                    'row_count': row_count,
                    'column_count': len(columns),
                    'columns': [col[1] for col in columns]
                }
            except Exception as e:
                table_stats[table] = {'error': str(e)}
        
        conn.close()
        return table_stats
    
    def check_indexes(self):
        """Check existing indexes and suggest optimizations"""
        conn = sqlite3.connect(self.db_path)
        
        # Get current indexes
        cursor = conn.execute("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='index'")
        indexes = cursor.fetchall()
        
        # Suggested indexes based on common queries
        suggested_indexes = [
            'CREATE INDEX IF NOT EXISTS idx_work_orders_created_date ON work_orders(created_date)',
            'CREATE INDEX IF NOT EXISTS idx_work_orders_service_code ON work_orders(service_code)',
            'CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON work_orders(customer_id)',
            'CREATE INDEX IF NOT EXISTS idx_dispensers_customer_id ON dispensers(customer_id)',
            'CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status)',
        ]
        
        conn.close()
        
        return {
            'existing_indexes': [{'name': idx[0], 'table': idx[1], 'sql': idx[2]} for idx in indexes],
            'suggested_indexes': suggested_indexes
        }
    
    def optimize_database(self):
        """Perform database optimization"""
        conn = sqlite3.connect(self.db_path)
        
        optimization_results = []
        
        # Vacuum database
        start_time = time.time()
        conn.execute('VACUUM')
        vacuum_time = time.time() - start_time
        optimization_results.append(f"VACUUM completed in {vacuum_time:.2f}s")
        
        # Analyze tables
        start_time = time.time()
        conn.execute('ANALYZE')
        analyze_time = time.time() - start_time
        optimization_results.append(f"ANALYZE completed in {analyze_time:.2f}s")
        
        # Reindex
        start_time = time.time()
        conn.execute('REINDEX')
        reindex_time = time.time() - start_time
        optimization_results.append(f"REINDEX completed in {reindex_time:.2f}s")
        
        conn.close()
        return optimization_results

def main():
    analyzer = DatabasePerformanceAnalyzer()
    
    print("Analyzing database performance...")
    
    # Analyze slow queries
    slow_queries = analyzer.analyze_slow_queries()
    print(f"\nQuery Performance Analysis:")
    for query_result in slow_queries:
        if query_result['status'] == 'success':
            print(f"  {query_result['execution_time']:.3f}s: {query_result['query'][:60]}...")
        else:
            print(f"  ERROR: {query_result['query'][:60]}...")
    
    # Analyze table statistics
    table_stats = analyzer.analyze_table_statistics()
    print(f"\nTable Statistics:")
    for table, stats in table_stats.items():
        if 'error' not in stats:
            print(f"  {table}: {stats['row_count']} rows, {stats['column_count']} columns")
    
    # Check indexes
    index_info = analyzer.check_indexes()
    print(f"\nIndex Analysis:")
    print(f"  Existing indexes: {len(index_info['existing_indexes'])}")
    print(f"  Suggested indexes: {len(index_info['suggested_indexes'])}")
    
    # Save analysis report
    report = {
        'timestamp': datetime.utcnow().isoformat(),
        'slow_queries': slow_queries,
        'table_statistics': table_stats,
        'index_analysis': index_info
    }
    
    with open('/logs/database-performance-analysis.json', 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"\nDatabase performance analysis completed")
    print(f"Report saved to: /logs/database-performance-analysis.json")

if __name__ == '__main__':
    main()
```

**Database Optimization Script:**
```bash
#!/bin/bash
# /tools/operations/optimize-database.sh

set -e

echo "Starting database optimization..."

# Backup database before optimization
BACKUP_FILE="/backups/pre-optimization/fossawork_v2_$(date +%Y%m%d_%H%M%S).db"
mkdir -p "/backups/pre-optimization"
cp /backend/fossawork_v2.db "$BACKUP_FILE"
echo "Database backed up to: $BACKUP_FILE"

# Stop backend to prevent writes during optimization
sudo systemctl stop fossawork-backend

# Run optimization
python /tools/operations/analyze-database-performance.py

# Apply suggested indexes
sqlite3 /backend/fossawork_v2.db << EOF
CREATE INDEX IF NOT EXISTS idx_work_orders_created_date ON work_orders(created_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_service_code ON work_orders(service_code);
CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_dispensers_customer_id ON dispensers(customer_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
VACUUM;
ANALYZE;
REINDEX;
EOF

# Restart backend
sudo systemctl start fossawork-backend

# Verify optimization
python /tools/operations/verify-database-optimization.py

echo "Database optimization completed"
```

### Connection Pool Optimization

**Connection Pool Configuration:**
```python
# /backend/app/database.py optimization

from sqlalchemy import create_engine
from sqlalchemy.pool import QueuePool

# Optimized connection pool settings
engine = create_engine(
    DATABASE_URL,
    poolclass=QueuePool,
    pool_size=20,          # Number of connections to keep open
    max_overflow=30,       # Additional connections beyond pool_size
    pool_recycle=3600,     # Recycle connections after 1 hour
    pool_pre_ping=True,    # Verify connections before use
    connect_args={
        "check_same_thread": False,
        "timeout": 20,
        "isolation_level": None
    }
)
```

## Application Performance Optimization

### Backend API Optimization

**Response Time Optimization:**
```python
#!/usr/bin/env python3
# /tools/operations/optimize-api-performance.py

import asyncio
import aiohttp
import time
from concurrent.futures import ThreadPoolExecutor

class APIPerformanceOptimizer:
    def __init__(self):
        self.performance_improvements = []
    
    def implement_caching(self):
        """Implement API response caching"""
        cache_config = """
# Add to backend requirements.txt
redis==4.5.4

# Add to app/core/cache.py
import redis
from functools import wraps
import json
import hashlib

redis_client = redis.Redis(host='localhost', port=6379, decode_responses=True)

def cache_response(expiration=300):
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create cache key
            cache_key = hashlib.md5(
                f"{func.__name__}:{str(args)}:{str(kwargs)}".encode()
            ).hexdigest()
            
            # Try to get from cache
            cached_result = redis_client.get(cache_key)
            if cached_result:
                return json.loads(cached_result)
            
            # Execute function and cache result
            result = await func(*args, **kwargs)
            redis_client.setex(cache_key, expiration, json.dumps(result))
            
            return result
        return wrapper
    return decorator
"""
        self.performance_improvements.append("API response caching implemented")
        return cache_config
    
    def implement_async_processing(self):
        """Implement async processing for heavy operations"""
        async_config = """
# Add to app/services/async_service.py
import asyncio
from concurrent.futures import ThreadPoolExecutor

class AsyncProcessingService:
    def __init__(self):
        self.executor = ThreadPoolExecutor(max_workers=4)
    
    async def process_form_automation_async(self, work_order_data):
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            self.executor, 
            self.process_form_automation_sync, 
            work_order_data
        )
        return result
    
    def process_form_automation_sync(self, work_order_data):
        # Heavy synchronous processing
        pass
"""
        self.performance_improvements.append("Async processing implemented")
        return async_config
    
    def implement_database_optimization(self):
        """Database query optimization suggestions"""
        db_optimization = """
# Add to app/services/database_optimization.py
from sqlalchemy.orm import joinedload, selectinload

class OptimizedQueries:
    @staticmethod
    def get_work_orders_with_dispensers(session, limit=100):
        # Use eager loading to prevent N+1 queries
        return session.query(WorkOrder)\\
            .options(joinedload(WorkOrder.dispensers))\\
            .limit(limit)\\
            .all()
    
    @staticmethod
    def get_work_orders_paginated(session, page=1, per_page=50):
        # Implement efficient pagination
        offset = (page - 1) * per_page
        return session.query(WorkOrder)\\
            .offset(offset)\\
            .limit(per_page)\\
            .all()
"""
        self.performance_improvements.append("Database query optimization implemented")
        return db_optimization
    
    def implement_response_compression(self):
        """Enable response compression"""
        compression_config = """
# Add to app/main.py
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Add to nginx configuration
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_proxied any;
gzip_comp_level 6;
gzip_types
    text/plain
    text/css
    text/xml
    text/javascript
    application/json
    application/javascript
    application/xml+rss
    application/atom+xml
    image/svg+xml;
"""
        self.performance_improvements.append("Response compression enabled")
        return compression_config

def main():
    optimizer = APIPerformanceOptimizer()
    
    print("Generating API performance optimization recommendations...")
    
    # Generate optimization configs
    cache_config = optimizer.implement_caching()
    async_config = optimizer.implement_async_processing()
    db_config = optimizer.implement_database_optimization()
    compression_config = optimizer.implement_response_compression()
    
    # Save recommendations
    with open('/docs/operations/api-performance-optimizations.md', 'w') as f:
        f.write("# API Performance Optimizations\n\n")
        f.write("## Response Caching\n")
        f.write("```python\n" + cache_config + "\n```\n\n")
        f.write("## Async Processing\n")
        f.write("```python\n" + async_config + "\n```\n\n")
        f.write("## Database Optimization\n")
        f.write("```python\n" + db_config + "\n```\n\n")
        f.write("## Response Compression\n")
        f.write("```\n" + compression_config + "\n```\n\n")
    
    print(f"Performance optimizations generated:")
    for improvement in optimizer.performance_improvements:
        print(f"  - {improvement}")
    
    print("\nRecommendations saved to: /docs/operations/api-performance-optimizations.md")

if __name__ == '__main__':
    main()
```

### Frontend Performance Optimization

**Frontend Optimization Script:**
```bash
#!/bin/bash
# /tools/operations/optimize-frontend.sh

set -e

echo "Starting frontend performance optimization..."

cd /frontend

# Bundle analysis
echo "Analyzing bundle size..."
npm run build
npx webpack-bundle-analyzer dist/static/js/*.js --mode server --port 8888 &
ANALYZER_PID=$!

# Code splitting optimization
echo "Implementing code splitting..."
cat > src/utils/lazyComponents.ts << 'EOF'
import { lazy } from 'react';

// Lazy load heavy components
export const BatchProcessor = lazy(() => import('../components/BatchProcessor'));
export const WorkOrderManager = lazy(() => import('../components/WorkOrderManager'));
export const DispenserManager = lazy(() => import('../components/DispenserManager'));
export const SettingsPanel = lazy(() => import('../components/SettingsPanel'));
EOF

# Implement virtual scrolling for large lists
echo "Adding virtual scrolling configuration..."
npm install react-window react-window-infinite-loader

# Optimize images and assets
echo "Optimizing static assets..."
find public/ -name "*.png" -exec optipng -o7 {} \;
find public/ -name "*.jpg" -exec jpegoptim --max=85 {} \;

# Enable service worker for caching
echo "Configuring service worker..."
cat > public/sw.js << 'EOF'
const CACHE_NAME = 'fossawork-v2-cache-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});
EOF

# Build optimized version
echo "Building optimized version..."
npm run build

# Stop bundle analyzer
kill $ANALYZER_PID 2>/dev/null || true

echo "Frontend optimization completed"
```

## Infrastructure Performance Optimization

### System Resource Optimization

**System Performance Tuning:**
```bash
#!/bin/bash
# /tools/operations/optimize-system-performance.sh

set -e

echo "Starting system performance optimization..."

# CPU optimization
echo "Optimizing CPU settings..."

# Set CPU governor to performance mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor

# Optimize CPU affinity for services
sudo systemctl edit fossawork-backend --force << 'EOF'
[Service]
CPUAffinity=0-3
Nice=-5
IOSchedulingClass=1
IOSchedulingPriority=4
EOF

sudo systemctl edit fossawork-frontend --force << 'EOF'
[Service]
CPUAffinity=4-7
Nice=0
EOF

# Memory optimization
echo "Optimizing memory settings..."

# Increase shared memory for SQLite
echo 'kernel.shmmax = 134217728' | sudo tee -a /etc/sysctl.conf
echo 'kernel.shmall = 2097152' | sudo tee -a /etc/sysctl.conf

# Optimize swappiness
echo 'vm.swappiness = 10' | sudo tee -a /etc/sysctl.conf

# Disk I/O optimization
echo "Optimizing disk I/O..."

# Set I/O scheduler to deadline for SSDs or mq-deadline for NVMe
DISK_DEVICE=$(df /backend | tail -1 | awk '{print $1}' | sed 's/[0-9]*$//')
if [[ -f /sys/block/${DISK_DEVICE##*/}/queue/scheduler ]]; then
    echo mq-deadline | sudo tee /sys/block/${DISK_DEVICE##*/}/queue/scheduler
fi

# Network optimization
echo "Optimizing network settings..."

# Increase network buffer sizes
echo 'net.core.rmem_default = 262144' | sudo tee -a /etc/sysctl.conf
echo 'net.core.rmem_max = 16777216' | sudo tee -a /etc/sysctl.conf
echo 'net.core.wmem_default = 262144' | sudo tee -a /etc/sysctl.conf
echo 'net.core.wmem_max = 16777216' | sudo tee -a /etc/sysctl.conf

# Apply sysctl changes
sudo sysctl -p

# Service-specific optimizations
echo "Applying service-specific optimizations..."

# Restart services to apply CPU affinity changes
sudo systemctl daemon-reload
sudo systemctl restart fossawork-backend
sudo systemctl restart fossawork-frontend

echo "System performance optimization completed"
echo "Note: Some changes require a reboot to take full effect"
```

### Load Balancing and Scaling

**Load Balancer Configuration:**
```nginx
# /etc/nginx/sites-available/fossawork-load-balanced
upstream fossawork_backend {
    least_conn;
    server 127.0.0.1:8000 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8001 weight=3 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:8002 weight=2 max_fails=3 fail_timeout=30s backup;
}

upstream fossawork_frontend {
    ip_hash;
    server 127.0.0.1:5173 weight=1 max_fails=2 fail_timeout=15s;
    server 127.0.0.1:5174 weight=1 max_fails=2 fail_timeout=15s;
}

server {
    listen 80;
    server_name fossawork.local;
    
    # Enable compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Enable caching for static assets
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://fossawork_frontend;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://fossawork_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Timeouts
        proxy_connect_timeout 30s;
        proxy_send_timeout 30s;
        proxy_read_timeout 60s;
        
        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }
    
    # Frontend application
    location / {
        proxy_pass http://fossawork_frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Performance Testing and Benchmarking

### Load Testing

**Load Testing Script:**
```python
#!/usr/bin/env python3
# /tools/operations/load-test.py

import asyncio
import aiohttp
import time
import json
import argparse
from datetime import datetime
from statistics import mean, median

class LoadTester:
    def __init__(self, base_url, max_concurrent=50):
        self.base_url = base_url
        self.max_concurrent = max_concurrent
        self.results = []
    
    async def single_request(self, session, endpoint, method='GET', data=None):
        """Execute a single HTTP request"""
        url = f"{self.base_url}{endpoint}"
        start_time = time.time()
        
        try:
            if method == 'GET':
                async with session.get(url) as response:
                    await response.text()
                    status = response.status
            elif method == 'POST':
                async with session.post(url, json=data) as response:
                    await response.text()
                    status = response.status
            
            response_time = time.time() - start_time
            return {
                'endpoint': endpoint,
                'method': method,
                'response_time': response_time,
                'status_code': status,
                'success': 200 <= status < 400
            }
        
        except Exception as e:
            response_time = time.time() - start_time
            return {
                'endpoint': endpoint,
                'method': method,
                'response_time': response_time,
                'status_code': None,
                'success': False,
                'error': str(e)
            }
    
    async def run_concurrent_requests(self, endpoint, num_requests, method='GET', data=None):
        """Run concurrent requests to an endpoint"""
        semaphore = asyncio.Semaphore(self.max_concurrent)
        
        async def bounded_request(session):
            async with semaphore:
                return await self.single_request(session, endpoint, method, data)
        
        async with aiohttp.ClientSession() as session:
            tasks = [bounded_request(session) for _ in range(num_requests)]
            results = await asyncio.gather(*tasks)
        
        return results
    
    async def run_load_test(self, test_scenarios):
        """Run complete load test with multiple scenarios"""
        print(f"Starting load test with {self.max_concurrent} max concurrent requests")
        
        all_results = []
        
        for scenario in test_scenarios:
            print(f"Testing {scenario['endpoint']} ({scenario['requests']} requests)...")
            
            start_time = time.time()
            results = await self.run_concurrent_requests(
                scenario['endpoint'],
                scenario['requests'],
                scenario.get('method', 'GET'),
                scenario.get('data')
            )
            total_time = time.time() - start_time
            
            # Analyze results
            successful_requests = [r for r in results if r['success']]
            failed_requests = [r for r in results if not r['success']]
            response_times = [r['response_time'] for r in successful_requests]
            
            scenario_stats = {
                'endpoint': scenario['endpoint'],
                'total_requests': len(results),
                'successful_requests': len(successful_requests),
                'failed_requests': len(failed_requests),
                'success_rate': len(successful_requests) / len(results) * 100,
                'total_time': total_time,
                'requests_per_second': len(results) / total_time,
                'avg_response_time': mean(response_times) if response_times else None,
                'median_response_time': median(response_times) if response_times else None,
                'min_response_time': min(response_times) if response_times else None,
                'max_response_time': max(response_times) if response_times else None
            }
            
            all_results.append(scenario_stats)
            
            print(f"  Success rate: {scenario_stats['success_rate']:.1f}%")
            print(f"  Avg response time: {scenario_stats['avg_response_time']:.3f}s")
            print(f"  Requests/second: {scenario_stats['requests_per_second']:.1f}")
            print()
        
        return all_results
    
    def generate_report(self, results):
        """Generate load test report"""
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'test_configuration': {
                'base_url': self.base_url,
                'max_concurrent': self.max_concurrent
            },
            'results': results,
            'summary': {
                'total_scenarios': len(results),
                'overall_success_rate': mean([r['success_rate'] for r in results]),
                'avg_requests_per_second': mean([r['requests_per_second'] for r in results])
            }
        }
        
        return report

async def main():
    parser = argparse.ArgumentParser(description='Load test FossaWork V2')
    parser.add_argument('--url', default='http://localhost:8000', help='Base URL')
    parser.add_argument('--concurrent', type=int, default=50, help='Max concurrent requests')
    parser.add_argument('--requests', type=int, default=100, help='Requests per scenario')
    
    args = parser.parse_args()
    
    # Define test scenarios
    test_scenarios = [
        {'endpoint': '/api/health', 'requests': args.requests},
        {'endpoint': '/api/work-orders', 'requests': args.requests},
        {'endpoint': '/api/dispensers', 'requests': args.requests},
        {'endpoint': '/api/auth/validate', 'requests': args.requests // 2, 'method': 'POST', 
         'data': {'token': 'test-token'}},
    ]
    
    # Run load test
    tester = LoadTester(args.url, args.concurrent)
    results = await tester.run_load_test(test_scenarios)
    
    # Generate and save report
    report = tester.generate_report(results)
    
    report_file = f'/logs/load-test-{datetime.utcnow().strftime("%Y%m%d-%H%M%S")}.json'
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"Load test completed. Report saved to: {report_file}")
    print(f"Overall success rate: {report['summary']['overall_success_rate']:.1f}%")
    print(f"Average requests/second: {report['summary']['avg_requests_per_second']:.1f}")

if __name__ == '__main__':
    asyncio.run(main())
```

### Performance Benchmarking

**Benchmark Comparison Tool:**
```python
#!/usr/bin/env python3
# /tools/operations/performance-benchmark.py

import json
import time
import sqlite3
import requests
from datetime import datetime
from pathlib import Path

class PerformanceBenchmark:
    def __init__(self):
        self.benchmark_results = {}
    
    def benchmark_database_operations(self):
        """Benchmark common database operations"""
        conn = sqlite3.connect('/backend/fossawork_v2.db')
        
        benchmarks = {}
        
        # Simple SELECT benchmark
        start_time = time.time()
        for _ in range(100):
            cursor = conn.execute('SELECT COUNT(*) FROM work_orders')
            cursor.fetchone()
        benchmarks['simple_select_100x'] = time.time() - start_time
        
        # Complex JOIN benchmark
        start_time = time.time()
        for _ in range(10):
            cursor = conn.execute('''
                SELECT wo.*, d.dispenser_id 
                FROM work_orders wo 
                LEFT JOIN dispensers d ON wo.customer_id = d.customer_id 
                LIMIT 50
            ''')
            cursor.fetchall()
        benchmarks['complex_join_10x'] = time.time() - start_time
        
        # INSERT benchmark
        start_time = time.time()
        for i in range(10):
            conn.execute('''
                INSERT INTO work_orders (job_id, customer_name, service_code, created_date) 
                VALUES (?, ?, ?, ?)
            ''', (f'BENCH-{i}', 'Benchmark Test', '2861', datetime.utcnow().isoformat()))
        conn.commit()
        benchmarks['insert_10x'] = time.time() - start_time
        
        # Cleanup benchmark data
        conn.execute("DELETE FROM work_orders WHERE job_id LIKE 'BENCH-%'")
        conn.commit()
        conn.close()
        
        return benchmarks
    
    def benchmark_api_endpoints(self):
        """Benchmark API endpoint performance"""
        base_url = 'http://localhost:8000'
        endpoints = [
            '/api/health',
            '/api/work-orders',
            '/api/dispensers',
        ]
        
        benchmarks = {}
        
        for endpoint in endpoints:
            times = []
            for _ in range(10):
                start_time = time.time()
                try:
                    response = requests.get(f'{base_url}{endpoint}', timeout=10)
                    if response.status_code == 200:
                        times.append(time.time() - start_time)
                except:
                    pass
            
            if times:
                benchmarks[endpoint] = {
                    'avg_time': sum(times) / len(times),
                    'min_time': min(times),
                    'max_time': max(times),
                    'successful_requests': len(times)
                }
        
        return benchmarks
    
    def run_full_benchmark(self):
        """Run complete performance benchmark"""
        print("Running performance benchmark...")
        
        # Database benchmarks
        print("  Benchmarking database operations...")
        db_benchmarks = self.benchmark_database_operations()
        
        # API benchmarks
        print("  Benchmarking API endpoints...")
        api_benchmarks = self.benchmark_api_endpoints()
        
        # Compile results
        benchmark_results = {
            'timestamp': datetime.utcnow().isoformat(),
            'database': db_benchmarks,
            'api': api_benchmarks
        }
        
        return benchmark_results
    
    def compare_with_baseline(self, results, baseline_file='/logs/performance-baseline.json'):
        """Compare current results with baseline"""
        if not Path(baseline_file).exists():
            print(f"No baseline found at {baseline_file}. Current results will be saved as baseline.")
            with open(baseline_file, 'w') as f:
                json.dump(results, f, indent=2)
            return None
        
        with open(baseline_file, 'r') as f:
            baseline = json.load(f)
        
        comparison = {
            'baseline_timestamp': baseline['timestamp'],
            'current_timestamp': results['timestamp'],
            'database_comparison': {},
            'api_comparison': {}
        }
        
        # Compare database performance
        for operation, current_time in results['database'].items():
            if operation in baseline['database']:
                baseline_time = baseline['database'][operation]
                change_percent = ((current_time - baseline_time) / baseline_time) * 100
                comparison['database_comparison'][operation] = {
                    'baseline': baseline_time,
                    'current': current_time,
                    'change_percent': change_percent,
                    'improvement': change_percent < 0
                }
        
        # Compare API performance
        for endpoint, current_stats in results['api'].items():
            if endpoint in baseline['api']:
                baseline_stats = baseline['api'][endpoint]
                current_avg = current_stats['avg_time']
                baseline_avg = baseline_stats['avg_time']
                change_percent = ((current_avg - baseline_avg) / baseline_avg) * 100
                comparison['api_comparison'][endpoint] = {
                    'baseline_avg': baseline_avg,
                    'current_avg': current_avg,
                    'change_percent': change_percent,
                    'improvement': change_percent < 0
                }
        
        return comparison

def main():
    benchmark = PerformanceBenchmark()
    
    # Run benchmark
    results = benchmark.run_full_benchmark()
    
    # Save results
    timestamp = datetime.utcnow().strftime('%Y%m%d-%H%M%S')
    results_file = f'/logs/performance-benchmark-{timestamp}.json'
    with open(results_file, 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"Benchmark results saved to: {results_file}")
    
    # Compare with baseline
    comparison = benchmark.compare_with_baseline(results)
    if comparison:
        comparison_file = f'/logs/performance-comparison-{timestamp}.json'
        with open(comparison_file, 'w') as f:
            json.dump(comparison, f, indent=2)
        
        print(f"Baseline comparison saved to: {comparison_file}")
        
        # Print summary
        print("\nPerformance Comparison Summary:")
        for operation, stats in comparison['database_comparison'].items():
            status = "IMPROVED" if stats['improvement'] else "DEGRADED"
            print(f"  DB {operation}: {status} by {abs(stats['change_percent']):.1f}%")
        
        for endpoint, stats in comparison['api_comparison'].items():
            status = "IMPROVED" if stats['improvement'] else "DEGRADED"
            print(f"  API {endpoint}: {status} by {abs(stats['change_percent']):.1f}%")

if __name__ == '__main__':
    main()
```

## Performance Monitoring and Alerting

### Continuous Performance Monitoring

**Performance Monitoring Service:**
```bash
#!/bin/bash
# /tools/operations/start-performance-monitoring.sh

set -e

echo "Starting continuous performance monitoring..."

# Create systemd service for performance monitoring
sudo tee /etc/systemd/system/fossawork-performance-monitor.service > /dev/null << 'EOF'
[Unit]
Description=FossaWork V2 Performance Monitor
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/tools/operations
ExecStart=/usr/bin/python3 /tools/operations/continuous-performance-monitor.py
Restart=always
RestartSec=30

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl daemon-reload
sudo systemctl enable fossawork-performance-monitor
sudo systemctl start fossawork-performance-monitor

# Set up log rotation for performance logs
sudo tee /etc/logrotate.d/fossawork-performance > /dev/null << 'EOF'
/logs/performance-*.jsonl {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 www-data www-data
}
EOF

echo "Performance monitoring service started"
echo "Check status: sudo systemctl status fossawork-performance-monitor"
echo "View logs: sudo journalctl -u fossawork-performance-monitor -f"
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-13  
**Next Review:** 2025-02-13  
**Owner:** Performance Engineering Team