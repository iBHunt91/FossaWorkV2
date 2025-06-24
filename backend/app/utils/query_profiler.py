"""
Query Profiler for detecting N+1 queries and performance issues
"""
import time
import functools
from typing import Dict, List, Any, Optional
from collections import defaultdict
import logging
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session
import re

logger = logging.getLogger(__name__)


class QueryProfiler:
    """Profile SQL queries to detect N+1 problems and performance issues"""
    
    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self.queries: List[Dict[str, Any]] = []
        self.query_patterns: Dict[str, List[Dict[str, Any]]] = defaultdict(list)
        self.start_time: Optional[float] = None
        self._active = False
        
    def start(self):
        """Start profiling queries"""
        if not self.enabled or self._active:
            return
            
        self._active = True
        self.queries = []
        self.query_patterns = defaultdict(list)
        self.start_time = time.time()
        
        # Attach SQLAlchemy event listeners
        event.listen(Engine, "before_cursor_execute", self._before_cursor_execute)
        event.listen(Engine, "after_cursor_execute", self._after_cursor_execute)
        
    def stop(self) -> Dict[str, Any]:
        """Stop profiling and return analysis"""
        if not self._active:
            return {}
            
        self._active = False
        
        # Remove event listeners
        event.remove(Engine, "before_cursor_execute", self._before_cursor_execute)
        event.remove(Engine, "after_cursor_execute", self._after_cursor_execute)
        
        return self.analyze()
        
    def _before_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        """Record query start time"""
        context._query_start_time = time.time()
        
    def _after_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        """Record query details after execution"""
        if not self._active:
            return
            
        duration = time.time() - context._query_start_time
        
        # Normalize the query to detect patterns
        normalized = self._normalize_query(statement)
        
        query_info = {
            'statement': statement,
            'parameters': parameters,
            'duration': duration,
            'normalized': normalized,
            'timestamp': time.time()
        }
        
        self.queries.append(query_info)
        self.query_patterns[normalized].append(query_info)
        
    def _normalize_query(self, query: str) -> str:
        """Normalize query to detect patterns (remove specific values)"""
        # Remove newlines and extra spaces
        normalized = ' '.join(query.split())
        
        # Replace quoted strings with placeholders
        normalized = re.sub(r"'[^']*'", "'?'", normalized)
        normalized = re.sub(r'"[^"]*"', '"?"', normalized)
        
        # Replace numbers with placeholders
        normalized = re.sub(r'\b\d+\b', '?', normalized)
        
        # Replace IN clauses with normalized form
        normalized = re.sub(r'IN\s*\([^)]+\)', 'IN (?)', normalized)
        
        return normalized
        
    def analyze(self) -> Dict[str, Any]:
        """Analyze queries for N+1 and performance issues"""
        if not self.queries:
            return {
                'total_queries': 0,
                'total_duration': 0,
                'n_plus_one_candidates': [],
                'slow_queries': [],
                'duplicate_queries': []
            }
            
        total_duration = sum(q['duration'] for q in self.queries)
        
        # Detect N+1 candidates
        n_plus_one_candidates = []
        for pattern, queries in self.query_patterns.items():
            if len(queries) > 1 and 'SELECT' in pattern.upper():
                # Look for patterns that might indicate N+1
                if any(keyword in pattern.upper() for keyword in ['WHERE', 'LIMIT 1']):
                    n_plus_one_candidates.append({
                        'pattern': pattern,
                        'count': len(queries),
                        'total_duration': sum(q['duration'] for q in queries),
                        'example': queries[0]['statement']
                    })
                    
        # Sort by count to find worst offenders
        n_plus_one_candidates.sort(key=lambda x: x['count'], reverse=True)
        
        # Find slow queries (> 100ms)
        slow_queries = [
            {
                'statement': q['statement'],
                'duration': q['duration'],
                'parameters': q['parameters']
            }
            for q in self.queries
            if q['duration'] > 0.1
        ]
        slow_queries.sort(key=lambda x: x['duration'], reverse=True)
        
        # Find exact duplicate queries
        seen_queries = defaultdict(int)
        for q in self.queries:
            key = (q['statement'], str(q['parameters']))
            seen_queries[key] += 1
            
        duplicate_queries = [
            {
                'statement': k[0],
                'parameters': k[1],
                'count': v
            }
            for k, v in seen_queries.items()
            if v > 1
        ]
        duplicate_queries.sort(key=lambda x: x['count'], reverse=True)
        
        return {
            'total_queries': len(self.queries),
            'total_duration': total_duration,
            'queries_per_second': len(self.queries) / (time.time() - self.start_time) if self.start_time else 0,
            'n_plus_one_candidates': n_plus_one_candidates[:10],  # Top 10
            'slow_queries': slow_queries[:10],  # Top 10
            'duplicate_queries': duplicate_queries[:10],  # Top 10
            'query_pattern_summary': {
                pattern: len(queries)
                for pattern, queries in self.query_patterns.items()
            }
        }
        
    def __enter__(self):
        """Context manager support"""
        self.start()
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager support"""
        results = self.stop()
        if self.enabled:
            self._log_results(results)
            
    def _log_results(self, results: Dict[str, Any]):
        """Log profiling results"""
        logger.info(f"Query Profiling Results:")
        logger.info(f"  Total queries: {results['total_queries']}")
        logger.info(f"  Total duration: {results['total_duration']:.3f}s")
        logger.info(f"  Queries/second: {results['queries_per_second']:.2f}")
        
        if results['n_plus_one_candidates']:
            logger.warning("Potential N+1 queries detected:")
            for candidate in results['n_plus_one_candidates'][:3]:
                logger.warning(f"  - Pattern executed {candidate['count']} times: {candidate['pattern'][:100]}...")
                
        if results['slow_queries']:
            logger.warning("Slow queries detected:")
            for query in results['slow_queries'][:3]:
                logger.warning(f"  - {query['duration']:.3f}s: {query['statement'][:100]}...")


def profile_endpoint(func):
    """Decorator to profile database queries in an endpoint"""
    @functools.wraps(func)
    async def wrapper(*args, **kwargs):
        profiler = QueryProfiler()
        with profiler:
            result = await func(*args, **kwargs)
        return result
    return wrapper


# Example usage for testing specific queries
def profile_query_performance(db: Session, query_func, *args, **kwargs):
    """Profile a specific query function"""
    profiler = QueryProfiler()
    
    with profiler:
        result = query_func(*args, **kwargs)
        
    analysis = profiler.analyze()
    
    print("\n=== Query Performance Analysis ===")
    print(f"Total queries: {analysis['total_queries']}")
    print(f"Total duration: {analysis['total_duration']:.3f}s")
    
    if analysis['n_plus_one_candidates']:
        print("\n⚠️  Potential N+1 Queries:")
        for candidate in analysis['n_plus_one_candidates']:
            print(f"  - Executed {candidate['count']} times: {candidate['pattern'][:80]}...")
            
    if analysis['slow_queries']:
        print("\n⚠️  Slow Queries (>100ms):")
        for query in analysis['slow_queries']:
            print(f"  - {query['duration']*1000:.1f}ms: {query['statement'][:80]}...")
            
    return result, analysis