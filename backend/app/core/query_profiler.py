"""
Query Profiler for detecting N+1 queries and performance issues

This module provides tools to profile database queries and detect common
performance problems like N+1 queries.
"""

import time
import logging
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.pool import Pool
import re

logger = logging.getLogger(__name__)

class QueryProfiler:
    """
    Profile database queries to detect N+1 queries and performance issues.
    
    Usage:
        profiler = QueryProfiler()
        profiler.start()
        # ... run your queries ...
        report = profiler.get_report()
        profiler.stop()
    """
    
    def __init__(self, threshold_ms: float = 100.0):
        self.queries: List[Dict] = []
        self.threshold_ms = threshold_ms
        self.start_time = None
        self.is_active = False
        self._listeners_attached = False
        
    def start(self):
        """Start profiling queries"""
        if not self._listeners_attached:
            self._attach_listeners()
        self.is_active = True
        self.start_time = time.time()
        self.queries = []
        logger.info("Query profiler started")
        
    def stop(self):
        """Stop profiling queries"""
        self.is_active = False
        if self._listeners_attached:
            self._detach_listeners()
        logger.info(f"Query profiler stopped. Captured {len(self.queries)} queries")
        
    def _attach_listeners(self):
        """Attach SQLAlchemy event listeners"""
        event.listen(Engine, "before_cursor_execute", self._before_cursor_execute)
        event.listen(Engine, "after_cursor_execute", self._after_cursor_execute)
        self._listeners_attached = True
        
    def _detach_listeners(self):
        """Detach SQLAlchemy event listeners"""
        event.remove(Engine, "before_cursor_execute", self._before_cursor_execute)
        event.remove(Engine, "after_cursor_execute", self._after_cursor_execute)
        self._listeners_attached = False
        
    def _before_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        """Record query start time"""
        if self.is_active:
            conn.info.setdefault('query_start_time', []).append(time.time())
            
    def _after_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        """Record query completion and details"""
        if self.is_active and conn.info.get('query_start_time'):
            elapsed = (time.time() - conn.info['query_start_time'].pop()) * 1000  # Convert to ms
            
            # Clean up the SQL statement for analysis
            clean_statement = self._clean_sql(statement)
            
            self.queries.append({
                'statement': statement,
                'clean_statement': clean_statement,
                'parameters': parameters,
                'elapsed_ms': elapsed,
                'timestamp': time.time()
            })
            
            # Log slow queries immediately
            if elapsed > self.threshold_ms:
                logger.warning(
                    f"Slow query detected ({elapsed:.2f}ms): {clean_statement[:100]}..."
                )
    
    def _clean_sql(self, statement: str) -> str:
        """Clean SQL statement for pattern matching"""
        # Remove newlines and extra spaces
        clean = ' '.join(statement.split())
        # Remove parameter placeholders
        clean = re.sub(r'\$\d+', '?', clean)  # PostgreSQL style
        clean = re.sub(r'%\(\w+\)s', '?', clean)  # psycopg2 style
        clean = re.sub(r'\?', '?', clean)  # Standard style
        return clean
    
    def detect_n_plus_one(self) -> List[Dict]:
        """
        Detect potential N+1 queries by finding similar queries executed multiple times.
        
        Returns list of potential N+1 query patterns with details.
        """
        if not self.queries:
            return []
        
        # Group queries by their pattern (ignoring parameters)
        query_patterns = defaultdict(list)
        
        for query in self.queries:
            # Extract table and operation pattern
            pattern = self._extract_pattern(query['clean_statement'])
            if pattern:
                query_patterns[pattern].append(query)
        
        # Find patterns that appear multiple times
        n_plus_one_candidates = []
        
        for pattern, queries in query_patterns.items():
            if len(queries) > 1:
                # Check if these are likely N+1 queries (similar timing, sequential)
                if self._is_likely_n_plus_one(queries):
                    n_plus_one_candidates.append({
                        'pattern': pattern,
                        'count': len(queries),
                        'total_time_ms': sum(q['elapsed_ms'] for q in queries),
                        'avg_time_ms': sum(q['elapsed_ms'] for q in queries) / len(queries),
                        'example_query': queries[0]['statement'],
                        'recommendation': self._get_recommendation(pattern)
                    })
        
        return sorted(n_plus_one_candidates, key=lambda x: x['count'], reverse=True)
    
    def _extract_pattern(self, statement: str) -> Optional[str]:
        """Extract a pattern from SQL statement for grouping"""
        statement_lower = statement.lower()
        
        # SELECT pattern
        if statement_lower.startswith('select'):
            match = re.search(r'from\s+(\w+)', statement_lower)
            if match:
                table = match.group(1)
                # Check for WHERE clause with ID
                if 'where' in statement_lower and '= ?' in statement:
                    return f"SELECT from {table} WHERE id = ?"
                return f"SELECT from {table}"
        
        # INSERT pattern
        elif statement_lower.startswith('insert'):
            match = re.search(r'into\s+(\w+)', statement_lower)
            if match:
                return f"INSERT into {match.group(1)}"
        
        # UPDATE pattern
        elif statement_lower.startswith('update'):
            match = re.search(r'update\s+(\w+)', statement_lower)
            if match:
                return f"UPDATE {match.group(1)}"
        
        return None
    
    def _is_likely_n_plus_one(self, queries: List[Dict]) -> bool:
        """Check if a group of queries is likely an N+1 pattern"""
        if len(queries) < 2:
            return False
        
        # Check if queries are close in time (within 1 second of each other)
        timestamps = [q['timestamp'] for q in queries]
        time_span = max(timestamps) - min(timestamps)
        
        # If queries span more than 10 seconds, probably not N+1
        if time_span > 10:
            return False
        
        # Check if they have similar execution times (within 50% of average)
        times = [q['elapsed_ms'] for q in queries]
        avg_time = sum(times) / len(times)
        
        for time_ms in times:
            if abs(time_ms - avg_time) > avg_time * 0.5:
                return False
        
        return True
    
    def _get_recommendation(self, pattern: str) -> str:
        """Get optimization recommendation for a query pattern"""
        pattern_lower = pattern.lower()
        
        if 'select' in pattern_lower and 'where id = ?' in pattern_lower:
            return "Use eager loading (joinedload/selectinload) or batch fetch"
        elif 'insert' in pattern_lower:
            return "Consider bulk_insert_mappings() for multiple inserts"
        elif 'update' in pattern_lower:
            return "Consider bulk_update_mappings() for multiple updates"
        else:
            return "Review query pattern for optimization opportunities"
    
    def get_report(self) -> Dict:
        """Generate a comprehensive profiling report"""
        if not self.queries:
            return {
                'total_queries': 0,
                'total_time_ms': 0,
                'message': 'No queries captured'
            }
        
        total_time = sum(q['elapsed_ms'] for q in self.queries)
        slow_queries = [q for q in self.queries if q['elapsed_ms'] > self.threshold_ms]
        n_plus_one = self.detect_n_plus_one()
        
        return {
            'profiling_duration_seconds': time.time() - self.start_time if self.start_time else 0,
            'total_queries': len(self.queries),
            'total_time_ms': total_time,
            'average_time_ms': total_time / len(self.queries) if self.queries else 0,
            'slow_queries': {
                'count': len(slow_queries),
                'threshold_ms': self.threshold_ms,
                'queries': [
                    {
                        'query': q['clean_statement'][:200] + '...' if len(q['clean_statement']) > 200 else q['clean_statement'],
                        'time_ms': q['elapsed_ms']
                    }
                    for q in sorted(slow_queries, key=lambda x: x['elapsed_ms'], reverse=True)[:10]
                ]
            },
            'n_plus_one_queries': n_plus_one,
            'recommendations': self._generate_recommendations(n_plus_one, slow_queries)
        }
    
    def _generate_recommendations(self, n_plus_one: List[Dict], slow_queries: List[Dict]) -> List[str]:
        """Generate actionable recommendations based on profiling results"""
        recommendations = []
        
        if n_plus_one:
            recommendations.append(
                f"Found {len(n_plus_one)} potential N+1 query patterns. "
                f"Total impact: {sum(q['total_time_ms'] for q in n_plus_one):.2f}ms"
            )
            for pattern in n_plus_one[:3]:  # Top 3 patterns
                recommendations.append(
                    f"- {pattern['pattern']}: {pattern['count']} queries, "
                    f"{pattern['total_time_ms']:.2f}ms total. {pattern['recommendation']}"
                )
        
        if slow_queries:
            recommendations.append(
                f"Found {len(slow_queries)} slow queries (>{self.threshold_ms}ms). "
                "Consider adding indexes or optimizing query structure."
            )
        
        if not recommendations:
            recommendations.append("No significant performance issues detected.")
        
        return recommendations


# Global profiler instance for easy access
_global_profiler = None

def get_profiler() -> QueryProfiler:
    """Get or create the global profiler instance"""
    global _global_profiler
    if _global_profiler is None:
        _global_profiler = QueryProfiler()
    return _global_profiler

def profile_request(func):
    """Decorator to profile database queries in a request"""
    async def wrapper(*args, **kwargs):
        profiler = get_profiler()
        profiler.start()
        try:
            result = await func(*args, **kwargs)
            report = profiler.get_report()
            
            # Log summary
            logger.info(
                f"Query profile for {func.__name__}: "
                f"{report['total_queries']} queries, "
                f"{report['total_time_ms']:.2f}ms total"
            )
            
            # Attach report to result if it's a dict
            if isinstance(result, dict):
                result['_query_profile'] = report
            
            return result
        finally:
            profiler.stop()
    
    return wrapper