#!/usr/bin/env python3
"""
FossaWork V2 Log Analyzer

Advanced log analysis tool for monitoring, troubleshooting, and alerting.
Analyzes structured JSON logs to identify patterns, errors, and performance issues.

Features:
- Error pattern detection and analysis
- Performance monitoring and alerting
- Security event analysis
- Real-time log monitoring
- Custom alert thresholds
- Automated report generation

Usage:
    python log-analyzer.py [options]
    
Examples:
    python log-analyzer.py --errors --last-hour
    python log-analyzer.py --performance --threshold=2000ms
    python log-analyzer.py --security --suspicious
    python log-analyzer.py --monitor --realtime
"""

import argparse
import json
import re
import time
from collections import defaultdict, Counter
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@dataclass
class LogEntry:
    """Structured log entry data class"""
    timestamp: datetime
    level: str
    message: str
    component: str
    source_file: str
    raw_data: Dict[str, Any]

@dataclass
class AnalysisResult:
    """Analysis result data class"""
    category: str
    severity: str
    count: int
    description: str
    details: List[Dict[str, Any]]
    recommendations: List[str]

class LogAnalyzer:
    def __init__(self, logs_dir: str = "/logs"):
        self.logs_dir = Path(logs_dir)
        self.error_patterns = {
            'database_error': [
                r'database.*error',
                r'sqlite.*error',
                r'connection.*refused',
                r'database.*locked'
            ],
            'authentication_error': [
                r'authentication.*failed',
                r'unauthorized',
                r'invalid.*token',
                r'login.*failed'
            ],
            'performance_error': [
                r'timeout',
                r'slow.*query',
                r'memory.*error',
                r'high.*cpu'
            ],
            'automation_error': [
                r'playwright.*error',
                r'browser.*error',
                r'automation.*failed',
                r'scraping.*error'
            ],
            'security_error': [
                r'security.*violation',
                r'suspicious.*activity',
                r'rate.*limit.*exceeded',
                r'blocked.*request'
            ]
        }
        
        self.performance_thresholds = {
            'api_response_time': 2000,  # ms
            'database_query_time': 500,  # ms
            'page_load_time': 5000,  # ms
            'automation_time': 30000  # ms
        }
        
        self.security_patterns = {
            'brute_force': r'failed.*login.*attempts',
            'sql_injection': r'(union.*select|drop.*table|insert.*into)',
            'xss_attempt': r'(<script|javascript:|onerror=)',
            'directory_traversal': r'(\.\./|\.\.\\)',
            'suspicious_user_agent': r'(sqlmap|nikto|nmap|burp)'
        }

    def parse_log_entry(self, line: str, source_file: str) -> Optional[LogEntry]:
        """Parse a JSON log line into a LogEntry object"""
        try:
            data = json.loads(line.strip())
            
            # Extract timestamp
            timestamp_str = data.get('timestamp', data.get('time', ''))
            if timestamp_str:
                try:
                    # Handle various timestamp formats
                    if 'T' in timestamp_str:
                        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    else:
                        timestamp = datetime.strptime(timestamp_str, '%Y-%m-%d %H:%M:%S')
                except:
                    timestamp = datetime.utcnow()
            else:
                timestamp = datetime.utcnow()
            
            return LogEntry(
                timestamp=timestamp,
                level=data.get('level', data.get('severity', 'INFO')).upper(),
                message=data.get('message', data.get('msg', '')),
                component=data.get('component', data.get('logger', 'unknown')),
                source_file=source_file,
                raw_data=data
            )
        except json.JSONDecodeError:
            return None
        except Exception as e:
            logger.warning(f"Error parsing log entry: {e}")
            return None

    def read_logs(self, timeframe: Optional[timedelta] = None, 
                 log_types: Optional[List[str]] = None) -> List[LogEntry]:
        """Read and parse log files within the specified timeframe"""
        entries = []
        cutoff_time = datetime.utcnow() - timeframe if timeframe else None
        
        # Determine which log files to read
        if log_types:
            patterns = [f"{log_type}*.jsonl" for log_type in log_types]
        else:
            patterns = ["*.jsonl"]
        
        for pattern in patterns:
            for log_file in self.logs_dir.rglob(pattern):
                try:
                    # Skip if file is too old
                    if cutoff_time and datetime.fromtimestamp(log_file.stat().st_mtime) < cutoff_time:
                        continue
                    
                    with open(log_file, 'r') as f:
                        for line in f:
                            entry = self.parse_log_entry(line, str(log_file))
                            if entry and (not cutoff_time or entry.timestamp > cutoff_time):
                                entries.append(entry)
                                
                except Exception as e:
                    logger.warning(f"Error reading log file {log_file}: {e}")
        
        return sorted(entries, key=lambda x: x.timestamp)

    def analyze_errors(self, entries: List[LogEntry]) -> List[AnalysisResult]:
        """Analyze error patterns in log entries"""
        results = []
        error_entries = [e for e in entries if e.level in ['ERROR', 'CRITICAL', 'FATAL']]
        
        if not error_entries:
            return results
        
        # Categorize errors by pattern
        categorized_errors = defaultdict(list)
        uncategorized_errors = []
        
        for entry in error_entries:
            categorized = False
            for category, patterns in self.error_patterns.items():
                for pattern in patterns:
                    if re.search(pattern, entry.message, re.IGNORECASE):
                        categorized_errors[category].append(entry)
                        categorized = True
                        break
                if categorized:
                    break
            
            if not categorized:
                uncategorized_errors.append(entry)
        
        # Generate analysis results for each category
        for category, errors in categorized_errors.items():
            severity = "high" if len(errors) > 10 else "medium"
            
            # Extract common error messages
            messages = Counter([e.message[:100] for e in errors])
            common_messages = messages.most_common(3)
            
            # Generate recommendations
            recommendations = self.get_error_recommendations(category, len(errors))
            
            results.append(AnalysisResult(
                category=f"error_{category}",
                severity=severity,
                count=len(errors),
                description=f"{category.replace('_', ' ').title()} errors detected",
                details=[
                    {
                        'most_common_messages': common_messages,
                        'time_range': f"{errors[0].timestamp} to {errors[-1].timestamp}",
                        'affected_components': list(set([e.component for e in errors]))
                    }
                ],
                recommendations=recommendations
            ))
        
        # Handle uncategorized errors
        if uncategorized_errors:
            messages = Counter([e.message[:100] for e in uncategorized_errors])
            results.append(AnalysisResult(
                category="error_uncategorized",
                severity="medium",
                count=len(uncategorized_errors),
                description="Uncategorized errors",
                details=[{'most_common_messages': messages.most_common(5)}],
                recommendations=["Review error patterns and update categorization rules"]
            ))
        
        return results

    def analyze_performance(self, entries: List[LogEntry]) -> List[AnalysisResult]:
        """Analyze performance-related log entries"""
        results = []
        
        # Analyze API response times
        api_times = []
        slow_queries = []
        
        for entry in entries:
            # Extract response time data
            if 'response_time' in entry.raw_data:
                response_time = entry.raw_data['response_time']
                if isinstance(response_time, (int, float)):
                    api_times.append(response_time * 1000)  # Convert to ms
                    
                    if response_time * 1000 > self.performance_thresholds['api_response_time']:
                        slow_queries.append({
                            'timestamp': entry.timestamp.isoformat(),
                            'endpoint': entry.raw_data.get('endpoint', 'unknown'),
                            'response_time': response_time * 1000,
                            'method': entry.raw_data.get('method', 'unknown')
                        })
        
        if api_times:
            avg_response_time = sum(api_times) / len(api_times)
            max_response_time = max(api_times)
            
            severity = "high" if avg_response_time > self.performance_thresholds['api_response_time'] else "medium"
            
            results.append(AnalysisResult(
                category="performance_api",
                severity=severity,
                count=len(api_times),
                description=f"API performance analysis",
                details=[
                    {
                        'average_response_time': f"{avg_response_time:.2f}ms",
                        'max_response_time': f"{max_response_time:.2f}ms",
                        'slow_requests': len(slow_queries),
                        'threshold': f"{self.performance_thresholds['api_response_time']}ms"
                    }
                ],
                recommendations=self.get_performance_recommendations(avg_response_time, slow_queries)
            ))
        
        return results

    def analyze_security(self, entries: List[LogEntry]) -> List[AnalysisResult]:
        """Analyze security-related events"""
        results = []
        security_events = defaultdict(list)
        
        for entry in entries:
            message_lower = entry.message.lower()
            
            # Check for security patterns
            for event_type, pattern in self.security_patterns.items():
                if re.search(pattern, message_lower):
                    security_events[event_type].append(entry)
        
        # Analyze authentication failures
        auth_failures = [e for e in entries if 'authentication' in e.message.lower() and e.level == 'ERROR']
        if auth_failures:
            # Group by IP or user
            failure_sources = defaultdict(int)
            for entry in auth_failures:
                source = entry.raw_data.get('ip', entry.raw_data.get('user', 'unknown'))
                failure_sources[source] += 1
            
            # Identify potential brute force attacks
            suspicious_sources = {k: v for k, v in failure_sources.items() if v > 5}
            
            severity = "high" if suspicious_sources else "medium"
            
            results.append(AnalysisResult(
                category="security_authentication",
                severity=severity,
                count=len(auth_failures),
                description="Authentication failure analysis",
                details=[
                    {
                        'total_failures': len(auth_failures),
                        'unique_sources': len(failure_sources),
                        'suspicious_sources': suspicious_sources,
                        'time_range': f"{auth_failures[0].timestamp} to {auth_failures[-1].timestamp}"
                    }
                ],
                recommendations=self.get_security_recommendations("authentication", suspicious_sources)
            ))
        
        # Analyze other security events
        for event_type, events in security_events.items():
            if events:
                results.append(AnalysisResult(
                    category=f"security_{event_type}",
                    severity="high",
                    count=len(events),
                    description=f"Security event: {event_type.replace('_', ' ')}",
                    details=[
                        {
                            'events': [
                                {
                                    'timestamp': e.timestamp.isoformat(),
                                    'message': e.message,
                                    'source': e.raw_data.get('ip', 'unknown')
                                } for e in events[:5]
                            ]
                        }
                    ],
                    recommendations=self.get_security_recommendations(event_type, events)
                ))
        
        return results

    def get_error_recommendations(self, category: str, count: int) -> List[str]:
        """Get recommendations for error categories"""
        recommendations = {
            'database_error': [
                "Check database connectivity and permissions",
                "Verify database file integrity",
                "Consider implementing connection pooling",
                "Monitor database resource usage"
            ],
            'authentication_error': [
                "Review authentication configuration",
                "Check JWT secret key setup",
                "Verify user credential storage",
                "Implement rate limiting for auth endpoints"
            ],
            'performance_error': [
                "Monitor system resource usage",
                "Optimize database queries",
                "Consider implementing caching",
                "Review application performance metrics"
            ],
            'automation_error': [
                "Check browser automation setup",
                "Verify Playwright installation",
                "Review automation timeout settings",
                "Monitor external service availability"
            ]
        }
        
        base_recommendations = recommendations.get(category, ["Investigate error patterns"])
        
        if count > 20:
            base_recommendations.append("Consider immediate intervention due to high error volume")
        
        return base_recommendations

    def get_performance_recommendations(self, avg_time: float, slow_queries: List) -> List[str]:
        """Get performance optimization recommendations"""
        recommendations = []
        
        if avg_time > self.performance_thresholds['api_response_time']:
            recommendations.extend([
                "Investigate slow API endpoints",
                "Consider database query optimization",
                "Implement response caching",
                "Review application resource usage"
            ])
        
        if len(slow_queries) > 10:
            recommendations.append("High number of slow queries detected - immediate optimization needed")
        
        return recommendations

    def get_security_recommendations(self, event_type: str, data: Any) -> List[str]:
        """Get security-related recommendations"""
        recommendations = {
            'authentication': [
                "Implement account lockout policies",
                "Enable two-factor authentication",
                "Review failed login monitoring",
                "Consider IP-based blocking"
            ],
            'brute_force': [
                "Implement rate limiting",
                "Block suspicious IP addresses",
                "Enable account lockout",
                "Review authentication logs"
            ],
            'sql_injection': [
                "Review input validation",
                "Implement parameterized queries",
                "Enable SQL injection detection",
                "Audit database access patterns"
            ]
        }
        
        return recommendations.get(event_type, ["Review security policies"])

    def generate_report(self, results: List[AnalysisResult], 
                       timeframe: str = "recent") -> Dict[str, Any]:
        """Generate comprehensive analysis report"""
        report = {
            'timestamp': datetime.utcnow().isoformat(),
            'timeframe': timeframe,
            'summary': {
                'total_categories': len(results),
                'high_severity_issues': len([r for r in results if r.severity == 'high']),
                'medium_severity_issues': len([r for r in results if r.severity == 'medium']),
                'total_events': sum([r.count for r in results])
            },
            'analysis_results': [],
            'recommendations': []
        }
        
        # Add detailed results
        for result in results:
            report['analysis_results'].append({
                'category': result.category,
                'severity': result.severity,
                'count': result.count,
                'description': result.description,
                'details': result.details,
                'recommendations': result.recommendations
            })
        
        # Compile top recommendations
        all_recommendations = []
        for result in results:
            all_recommendations.extend(result.recommendations)
        
        recommendation_counts = Counter(all_recommendations)
        report['recommendations'] = [rec for rec, _ in recommendation_counts.most_common(10)]
        
        return report

    def monitor_realtime(self, callback=None, interval: int = 60):
        """Monitor logs in real-time and trigger alerts"""
        logger.info("Starting real-time log monitoring...")
        
        last_check = datetime.utcnow()
        
        while True:
            try:
                # Analyze logs from the last interval
                timeframe = timedelta(seconds=interval)
                entries = self.read_logs(timeframe)
                
                if entries:
                    # Quick analysis for critical issues
                    critical_errors = [e for e in entries if e.level in ['CRITICAL', 'FATAL']]
                    high_error_rate = len([e for e in entries if e.level == 'ERROR']) > 10
                    
                    if critical_errors or high_error_rate:
                        alert = {
                            'timestamp': datetime.utcnow().isoformat(),
                            'type': 'realtime_alert',
                            'critical_errors': len(critical_errors),
                            'total_errors': len([e for e in entries if e.level == 'ERROR']),
                            'timeframe': f"{interval}s"
                        }
                        
                        if callback:
                            callback(alert)
                        else:
                            logger.warning(f"ALERT: {alert}")
                
                last_check = datetime.utcnow()
                time.sleep(interval)
                
            except KeyboardInterrupt:
                logger.info("Real-time monitoring stopped")
                break
            except Exception as e:
                logger.error(f"Error in real-time monitoring: {e}")
                time.sleep(interval)

def main():
    parser = argparse.ArgumentParser(description='FossaWork V2 Log Analyzer')
    
    # Analysis type options
    parser.add_argument('--errors', action='store_true', help='Analyze error patterns')
    parser.add_argument('--performance', action='store_true', help='Analyze performance metrics')
    parser.add_argument('--security', action='store_true', help='Analyze security events')
    parser.add_argument('--suspicious', action='store_true', help='Look for suspicious activities')
    
    # Time range options
    parser.add_argument('--last-hour', action='store_true', help='Analyze last hour')
    parser.add_argument('--last-24h', action='store_true', help='Analyze last 24 hours')
    parser.add_argument('--last-week', action='store_true', help='Analyze last week')
    
    # Output options
    parser.add_argument('--json', action='store_true', help='Output in JSON format')
    parser.add_argument('--report', action='store_true', help='Generate detailed report')
    parser.add_argument('--output', type=str, help='Output file path')
    
    # Monitoring options
    parser.add_argument('--monitor', action='store_true', help='Real-time monitoring mode')
    parser.add_argument('--interval', type=int, default=60, help='Monitoring interval in seconds')
    
    # Configuration options
    parser.add_argument('--logs-dir', type=str, default='/logs', help='Logs directory path')
    parser.add_argument('--threshold', type=str, help='Performance threshold (e.g., 2000ms)')
    
    args = parser.parse_args()
    
    # Create analyzer
    analyzer = LogAnalyzer(args.logs_dir)
    
    # Set custom threshold if provided
    if args.threshold:
        try:
            threshold_ms = int(args.threshold.replace('ms', ''))
            analyzer.performance_thresholds['api_response_time'] = threshold_ms
        except ValueError:
            logger.error(f"Invalid threshold format: {args.threshold}")
            return 1
    
    # Determine timeframe
    timeframe = None
    timeframe_str = "all time"
    
    if args.last_hour:
        timeframe = timedelta(hours=1)
        timeframe_str = "last hour"
    elif args.last_24h:
        timeframe = timedelta(hours=24)
        timeframe_str = "last 24 hours"
    elif args.last_week:
        timeframe = timedelta(days=7)
        timeframe_str = "last week"
    
    # Real-time monitoring mode
    if args.monitor:
        def alert_callback(alert):
            if args.json:
                print(json.dumps(alert))
            else:
                print(f"🚨 ALERT: {alert['critical_errors']} critical errors, {alert['total_errors']} total errors in {alert['timeframe']}")
        
        analyzer.monitor_realtime(alert_callback, args.interval)
        return 0
    
    # Read and analyze logs
    logger.info(f"Reading logs from {timeframe_str}")
    entries = analyzer.read_logs(timeframe)
    
    if not entries:
        print("No log entries found for the specified timeframe")
        return 0
    
    logger.info(f"Analyzing {len(entries)} log entries")
    
    # Perform analysis
    all_results = []
    
    if args.errors or not any([args.performance, args.security]):
        all_results.extend(analyzer.analyze_errors(entries))
    
    if args.performance:
        all_results.extend(analyzer.analyze_performance(entries))
    
    if args.security or args.suspicious:
        all_results.extend(analyzer.analyze_security(entries))
    
    # Generate output
    if args.report:
        report = analyzer.generate_report(all_results, timeframe_str)
        
        if args.json:
            output = json.dumps(report, indent=2)
        else:
            output = format_report(report)
    else:
        if args.json:
            output = json.dumps([result.__dict__ for result in all_results], indent=2, default=str)
        else:
            output = format_simple_results(all_results)
    
    # Save or print output
    if args.output:
        with open(args.output, 'w') as f:
            f.write(output)
        logger.info(f"Results saved to {args.output}")
    else:
        print(output)
    
    return 0

def format_report(report: Dict[str, Any]) -> str:
    """Format report for human-readable output"""
    output = []
    output.append("=" * 60)
    output.append("FossaWork V2 Log Analysis Report")
    output.append("=" * 60)
    output.append(f"Generated: {report['timestamp']}")
    output.append(f"Timeframe: {report['timeframe']}")
    output.append(f"Total Categories: {report['summary']['total_categories']}")
    output.append(f"High Severity Issues: {report['summary']['high_severity_issues']}")
    output.append(f"Medium Severity Issues: {report['summary']['medium_severity_issues']}")
    output.append(f"Total Events: {report['summary']['total_events']}")
    output.append("")
    
    # Analysis results
    for result in report['analysis_results']:
        output.append(f"📊 {result['description']}")
        output.append(f"   Severity: {result['severity'].upper()}")
        output.append(f"   Count: {result['count']}")
        
        if result['details']:
            output.append("   Details:")
            for detail in result['details']:
                for key, value in detail.items():
                    output.append(f"     {key}: {value}")
        
        if result['recommendations']:
            output.append("   Recommendations:")
            for rec in result['recommendations']:
                output.append(f"     • {rec}")
        
        output.append("")
    
    # Top recommendations
    if report['recommendations']:
        output.append("🔧 Top Recommendations:")
        for i, rec in enumerate(report['recommendations'], 1):
            output.append(f"  {i}. {rec}")
    
    return "\n".join(output)

def format_simple_results(results: List[AnalysisResult]) -> str:
    """Format simple results for human-readable output"""
    if not results:
        return "✅ No issues found in log analysis"
    
    output = []
    for result in results:
        severity_icon = "🔴" if result.severity == "high" else "🟡"
        output.append(f"{severity_icon} {result.description} ({result.count} events)")
        
        if result.recommendations:
            for rec in result.recommendations[:2]:  # Show first 2 recommendations
                output.append(f"   💡 {rec}")
        output.append("")
    
    return "\n".join(output)

if __name__ == '__main__':
    exit(main())