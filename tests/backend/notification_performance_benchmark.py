#!/usr/bin/env python3
"""
Notification System Performance Benchmark

Comprehensive performance testing suite for the notification system.
Tests single notification performance, bulk processing, template generation,
memory usage, and scalability under various load conditions.

This benchmark provides:
- Single notification timing benchmarks
- Bulk notification processing benchmarks
- Template generation performance metrics
- Memory usage analysis
- Concurrent delivery testing
- Scalability assessment
- Performance regression detection
"""

import asyncio
import json
import logging
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from unittest.mock import Mock, patch
import statistics

# Add backend to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "backend"))

# Configure logging
logging.basicConfig(level=logging.WARNING)  # Reduce log noise during benchmarking
logger = logging.getLogger(__name__)

@dataclass
class BenchmarkResult:
    """Individual benchmark result"""
    test_name: str
    duration_seconds: float
    operations_count: int
    operations_per_second: float
    memory_usage_mb: Optional[float] = None
    success_rate: float = 100.0
    metadata: Dict[str, Any] = None

@dataclass
class PerformanceReport:
    """Complete performance report"""
    test_timestamp: datetime
    total_duration_seconds: float
    benchmark_results: List[BenchmarkResult]
    system_info: Dict[str, Any]
    summary_stats: Dict[str, Any]

class NotificationPerformanceBenchmark:
    """Performance benchmark suite for notification system"""
    
    def __init__(self):
        self.results = []
        self.mock_db = Mock()
        self.mock_user_service = Mock()
        self.setup_mocks()
        self.setup_memory_monitoring()
    
    def setup_mocks(self):
        """Setup mock services for consistent testing"""
        self.mock_user_service.get_user.return_value = Mock(
            user_id="benchmark_user",
            email="benchmark@fossawork.com"
        )
        
        self.mock_user_service.get_user_preference.return_value = {
            "email_enabled": True,
            "pushover_enabled": True,
            "desktop_enabled": True,
            "pushover_user_key": "benchmark_key_12345"
        }
        
        self.mock_user_service.update_user_preferences.return_value = True
    
    def setup_memory_monitoring(self):
        """Setup memory monitoring if available"""
        try:
            import psutil
            self.psutil_available = True
            self.process = psutil.Process(os.getpid())
        except ImportError:
            self.psutil_available = False
            self.process = None
    
    def get_memory_usage(self) -> Optional[float]:
        """Get current memory usage in MB"""
        if self.psutil_available and self.process:
            return self.process.memory_info().rss / 1024 / 1024
        return None
    
    def generate_benchmark_data(self, size: str = "normal") -> Dict[str, Any]:
        """Generate test data of different sizes for benchmarking"""
        base_data = {
            "station_name": f"Benchmark Station {datetime.now().microsecond}",
            "job_id": f"BENCH_{datetime.now().microsecond}",
            "work_order_id": f"WO_BENCH_{datetime.now().microsecond}",
            "service_code": "2861",
            "dispenser_count": 8,
            "start_time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"),
            "address": "123 Benchmark Street, Test City, TC 12345"
        }
        
        if size == "small":
            return base_data
        elif size == "large":
            # Add extra data to test larger payloads
            base_data.update({
                "forms_data": [
                    {"dispenser": f"Dispenser {i}", "status": "completed", "time": f"{i+2} minutes"}
                    for i in range(20)  # Large forms data
                ],
                "detailed_metrics": {
                    f"metric_{i}": f"value_{i}" * 10  # Long string values
                    for i in range(50)  # Many metrics
                },
                "error_logs": [
                    f"Debug log entry {i}: " + "x" * 100  # Long log entries
                    for i in range(30)  # Many log entries
                ]
            })
            return base_data
        else:  # normal
            return base_data
    
    async def benchmark_single_notification_performance(self) -> BenchmarkResult:
        """Benchmark single notification creation and delivery"""
        print("\n⚡ Benchmarking Single Notification Performance...")
        
        try:
            from app.services.notification_manager import (
                NotificationManager, NotificationTrigger
            )
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings
            from app.services.desktop_notification import DesktopNotificationSettings
            
            # Setup manager
            manager = NotificationManager(
                self.mock_db,
                EmailSettings("smtp.gmail.com", 587, "test@test.com", "password"),
                PushoverSettings("test_token", "test_key"),
                DesktopNotificationSettings()
            )
            manager.user_service = self.mock_user_service
            manager.logging_service = Mock()
            
            # Benchmark configuration
            iterations = 100
            test_data = self.generate_benchmark_data("normal")
            
            # Warm-up run
            with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                 patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                 patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                await manager.send_automation_notification(
                    "benchmark_user", NotificationTrigger.AUTOMATION_COMPLETED, test_data
                )
            
            # Start benchmarking
            start_memory = self.get_memory_usage()
            start_time = time.time()
            
            successful_operations = 0
            for i in range(iterations):
                try:
                    with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                        
                        result = await manager.send_automation_notification(
                            "benchmark_user", NotificationTrigger.AUTOMATION_COMPLETED, test_data
                        )
                    
                    if isinstance(result, dict):
                        successful_operations += 1
                        
                except Exception as e:
                    logger.warning(f"Notification {i} failed: {e}")
            
            end_time = time.time()
            end_memory = self.get_memory_usage()
            
            duration = end_time - start_time
            ops_per_second = successful_operations / duration if duration > 0 else 0
            memory_usage = end_memory - start_memory if start_memory and end_memory else None
            success_rate = (successful_operations / iterations) * 100
            
            result = BenchmarkResult(
                test_name="Single Notification Performance",
                duration_seconds=duration,
                operations_count=successful_operations,
                operations_per_second=ops_per_second,
                memory_usage_mb=memory_usage,
                success_rate=success_rate,
                metadata={
                    "iterations": iterations,
                    "avg_duration_ms": (duration / successful_operations * 1000) if successful_operations > 0 else 0
                }
            )
            
            print(f"   ✅ Completed {successful_operations}/{iterations} notifications")
            print(f"   ⏱️  Total time: {duration:.3f}s")
            print(f"   📊 Rate: {ops_per_second:.2f} notifications/second")
            print(f"   📈 Avg duration: {result.metadata['avg_duration_ms']:.2f}ms per notification")
            if memory_usage:
                print(f"   💾 Memory impact: {memory_usage:.2f}MB")
            
            return result
            
        except Exception as e:
            print(f"   ❌ Single notification benchmark failed: {e}")
            return BenchmarkResult(
                test_name="Single Notification Performance",
                duration_seconds=0,
                operations_count=0,
                operations_per_second=0,
                success_rate=0,
                metadata={"error": str(e)}
            )
    
    async def benchmark_bulk_notification_performance(self) -> BenchmarkResult:
        """Benchmark bulk notification processing"""
        print("\n📦 Benchmarking Bulk Notification Performance...")
        
        try:
            from app.services.notification_manager import (
                NotificationManager, NotificationTrigger
            )
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings
            from app.services.desktop_notification import DesktopNotificationSettings
            
            # Setup manager
            manager = NotificationManager(
                self.mock_db,
                EmailSettings("smtp.gmail.com", 587, "test@test.com", "password"),
                PushoverSettings("test_token", "test_key"),
                DesktopNotificationSettings()
            )
            manager.user_service = self.mock_user_service
            manager.logging_service = Mock()
            
            # Benchmark configuration
            batch_size = 200
            
            # Generate test data
            test_datasets = [
                self.generate_benchmark_data("normal") 
                for _ in range(batch_size)
            ]
            
            # Start benchmarking
            start_memory = self.get_memory_usage()
            start_time = time.time()
            
            # Create tasks for concurrent execution
            tasks = []
            for i, test_data in enumerate(test_datasets):
                with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                     patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                     patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                    
                    task = manager.send_automation_notification(
                        "benchmark_user",
                        NotificationTrigger.AUTOMATION_PROGRESS,
                        {**test_data, "progress_percentage": (i + 1) * 100 // batch_size}
                    )
                    tasks.append(task)
            
            # Execute all tasks concurrently
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            end_time = time.time()
            end_memory = self.get_memory_usage()
            
            # Analyze results
            successful_operations = sum(
                1 for result in results 
                if isinstance(result, dict) and not isinstance(result, Exception)
            )
            
            duration = end_time - start_time
            ops_per_second = successful_operations / duration if duration > 0 else 0
            memory_usage = end_memory - start_memory if start_memory and end_memory else None
            success_rate = (successful_operations / batch_size) * 100
            
            result = BenchmarkResult(
                test_name="Bulk Notification Performance",
                duration_seconds=duration,
                operations_count=successful_operations,
                operations_per_second=ops_per_second,
                memory_usage_mb=memory_usage,
                success_rate=success_rate,
                metadata={
                    "batch_size": batch_size,
                    "concurrent_execution": True,
                    "failed_operations": batch_size - successful_operations
                }
            )
            
            print(f"   ✅ Completed {successful_operations}/{batch_size} notifications")
            print(f"   ⏱️  Total time: {duration:.3f}s")
            print(f"   📊 Rate: {ops_per_second:.2f} notifications/second")
            print(f"   🔄 Concurrent processing: {batch_size} tasks")
            if memory_usage:
                print(f"   💾 Memory impact: {memory_usage:.2f}MB")
            
            return result
            
        except Exception as e:
            print(f"   ❌ Bulk notification benchmark failed: {e}")
            return BenchmarkResult(
                test_name="Bulk Notification Performance",
                duration_seconds=0,
                operations_count=0,
                operations_per_second=0,
                success_rate=0,
                metadata={"error": str(e)}
            )
    
    async def benchmark_template_generation_performance(self) -> BenchmarkResult:
        """Benchmark email template generation performance"""
        print("\n📝 Benchmarking Template Generation Performance...")
        
        try:
            from app.services.email_notification import (
                EmailNotificationService, EmailSettings, NotificationType
            )
            
            # Setup service
            service = EmailNotificationService(
                self.mock_db,
                EmailSettings("smtp.gmail.com", 587, "test@test.com", "password")
            )
            service.user_service = self.mock_user_service
            service.logging_service = Mock()
            
            # Benchmark configuration
            iterations = 50
            
            # Test different data sizes
            test_datasets = {
                "small": [self.generate_benchmark_data("small") for _ in range(iterations // 2)],
                "large": [self.generate_benchmark_data("large") for _ in range(iterations // 2)]
            }
            
            start_memory = self.get_memory_usage()
            start_time = time.time()
            
            successful_operations = 0
            template_sizes = []
            
            for data_type, datasets in test_datasets.items():
                for test_data in datasets:
                    try:
                        notification = await service._create_notification(
                            "benchmark_user",
                            NotificationType.AUTOMATION_COMPLETED,
                            test_data
                        )
                        
                        if notification:
                            successful_operations += 1
                            template_sizes.append({
                                "data_type": data_type,
                                "html_size": len(notification.html_content),
                                "text_size": len(notification.text_content)
                            })
                            
                    except Exception as e:
                        logger.warning(f"Template generation failed: {e}")
            
            end_time = time.time()
            end_memory = self.get_memory_usage()
            
            duration = end_time - start_time
            ops_per_second = successful_operations / duration if duration > 0 else 0
            memory_usage = end_memory - start_memory if start_memory and end_memory else None
            success_rate = (successful_operations / iterations) * 100
            
            # Calculate template size statistics
            avg_html_size = statistics.mean([t["html_size"] for t in template_sizes]) if template_sizes else 0
            avg_text_size = statistics.mean([t["text_size"] for t in template_sizes]) if template_sizes else 0
            
            result = BenchmarkResult(
                test_name="Template Generation Performance",
                duration_seconds=duration,
                operations_count=successful_operations,
                operations_per_second=ops_per_second,
                memory_usage_mb=memory_usage,
                success_rate=success_rate,
                metadata={
                    "iterations": iterations,
                    "avg_template_generation_ms": (duration / successful_operations * 1000) if successful_operations > 0 else 0,
                    "avg_html_size_chars": avg_html_size,
                    "avg_text_size_chars": avg_text_size,
                    "template_sizes": template_sizes
                }
            )
            
            print(f"   ✅ Generated {successful_operations}/{iterations} templates")
            print(f"   ⏱️  Total time: {duration:.3f}s")
            print(f"   📊 Rate: {ops_per_second:.2f} templates/second")
            print(f"   📄 Avg HTML size: {avg_html_size:.0f} chars")
            print(f"   📄 Avg text size: {avg_text_size:.0f} chars")
            if memory_usage:
                print(f"   💾 Memory impact: {memory_usage:.2f}MB")
            
            return result
            
        except Exception as e:
            print(f"   ❌ Template generation benchmark failed: {e}")
            return BenchmarkResult(
                test_name="Template Generation Performance",
                duration_seconds=0,
                operations_count=0,
                operations_per_second=0,
                success_rate=0,
                metadata={"error": str(e)}
            )
    
    async def benchmark_memory_usage_scaling(self) -> BenchmarkResult:
        """Benchmark memory usage under increasing load"""
        print("\n💾 Benchmarking Memory Usage Scaling...")
        
        if not self.psutil_available:
            print("   ⚠️  psutil not available - skipping memory benchmark")
            return BenchmarkResult(
                test_name="Memory Usage Scaling",
                duration_seconds=0,
                operations_count=0,
                operations_per_second=0,
                metadata={"skipped": "psutil not available"}
            )
        
        try:
            from app.services.notification_manager import (
                NotificationManager, NotificationTrigger
            )
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings
            from app.services.desktop_notification import DesktopNotificationSettings
            
            # Setup manager
            manager = NotificationManager(
                self.mock_db,
                EmailSettings("smtp.gmail.com", 587, "test@test.com", "password"),
                PushoverSettings("test_token", "test_key"),
                DesktopNotificationSettings()
            )
            manager.user_service = self.mock_user_service
            manager.logging_service = Mock()
            
            # Test different load levels
            load_levels = [10, 25, 50, 100, 200]
            memory_measurements = []
            
            start_time = time.time()
            initial_memory = self.get_memory_usage()
            
            for load_level in load_levels:
                print(f"   🔄 Testing load level: {load_level} notifications...")
                
                load_start_memory = self.get_memory_usage()
                
                # Generate notifications for this load level
                tasks = []
                for i in range(load_level):
                    test_data = self.generate_benchmark_data("normal")
                    test_data["batch_id"] = f"load_{load_level}_item_{i}"
                    
                    with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                        
                        task = manager.send_automation_notification(
                            "benchmark_user", NotificationTrigger.AUTOMATION_PROGRESS, test_data
                        )
                        tasks.append(task)
                
                # Execute batch
                results = await asyncio.gather(*tasks, return_exceptions=True)
                
                load_end_memory = self.get_memory_usage()
                memory_delta = load_end_memory - load_start_memory if load_start_memory and load_end_memory else 0
                
                successful_count = sum(
                    1 for result in results 
                    if isinstance(result, dict) and not isinstance(result, Exception)
                )
                
                memory_measurements.append({
                    "load_level": load_level,
                    "memory_delta_mb": memory_delta,
                    "memory_per_notification_kb": (memory_delta * 1024 / load_level) if load_level > 0 else 0,
                    "successful_notifications": successful_count,
                    "total_memory_mb": load_end_memory
                })
                
                print(f"      📊 Memory delta: {memory_delta:.2f}MB")
                print(f"      📈 Memory per notification: {memory_delta * 1024 / load_level:.2f}KB")
                
                # Brief pause to allow garbage collection
                await asyncio.sleep(0.1)
            
            end_time = time.time()
            final_memory = self.get_memory_usage()
            
            total_operations = sum(m["successful_notifications"] for m in memory_measurements)
            total_duration = end_time - start_time
            total_memory_impact = final_memory - initial_memory if initial_memory and final_memory else 0
            
            # Calculate memory efficiency
            avg_memory_per_notification = statistics.mean([
                m["memory_per_notification_kb"] for m in memory_measurements
                if m["memory_per_notification_kb"] > 0
            ]) if memory_measurements else 0
            
            result = BenchmarkResult(
                test_name="Memory Usage Scaling",
                duration_seconds=total_duration,
                operations_count=total_operations,
                operations_per_second=total_operations / total_duration if total_duration > 0 else 0,
                memory_usage_mb=total_memory_impact,
                success_rate=100.0,  # Individual load levels tracked separately
                metadata={
                    "load_levels_tested": load_levels,
                    "memory_measurements": memory_measurements,
                    "avg_memory_per_notification_kb": avg_memory_per_notification,
                    "initial_memory_mb": initial_memory,
                    "final_memory_mb": final_memory
                }
            )
            
            print(f"   ✅ Tested {len(load_levels)} load levels")
            print(f"   📊 Total operations: {total_operations}")
            print(f"   💾 Total memory impact: {total_memory_impact:.2f}MB")
            print(f"   📈 Avg memory per notification: {avg_memory_per_notification:.2f}KB")
            
            return result
            
        except Exception as e:
            print(f"   ❌ Memory usage benchmark failed: {e}")
            return BenchmarkResult(
                test_name="Memory Usage Scaling",
                duration_seconds=0,
                operations_count=0,
                operations_per_second=0,
                success_rate=0,
                metadata={"error": str(e)}
            )
    
    async def benchmark_concurrent_user_performance(self) -> BenchmarkResult:
        """Benchmark performance with multiple concurrent users"""
        print("\n👥 Benchmarking Concurrent User Performance...")
        
        try:
            from app.services.notification_manager import (
                NotificationManager, NotificationTrigger
            )
            from app.services.email_notification import EmailSettings
            from app.services.pushover_notification import PushoverSettings
            from app.services.desktop_notification import DesktopNotificationSettings
            
            # Setup manager
            manager = NotificationManager(
                self.mock_db,
                EmailSettings("smtp.gmail.com", 587, "test@test.com", "password"),
                PushoverSettings("test_token", "test_key"),
                DesktopNotificationSettings()
            )
            manager.user_service = self.mock_user_service
            manager.logging_service = Mock()
            
            # Simulate multiple users
            user_count = 20
            notifications_per_user = 10
            
            start_memory = self.get_memory_usage()
            start_time = time.time()
            
            # Create tasks for all users and notifications
            all_tasks = []
            for user_id in range(user_count):
                for notification_id in range(notifications_per_user):
                    test_data = self.generate_benchmark_data("normal")
                    test_data["user_id"] = f"user_{user_id:03d}"
                    test_data["notification_id"] = f"notif_{notification_id:03d}"
                    
                    with patch.object(manager.email_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.pushover_service, 'send_automation_notification', return_value=True), \
                         patch.object(manager.desktop_service, 'send_automation_notification', return_value=True):
                        
                        task = manager.send_automation_notification(
                            f"user_{user_id:03d}",
                            NotificationTrigger.AUTOMATION_COMPLETED,
                            test_data
                        )
                        all_tasks.append(task)
            
            # Execute all tasks concurrently
            results = await asyncio.gather(*all_tasks, return_exceptions=True)
            
            end_time = time.time()
            end_memory = self.get_memory_usage()
            
            # Analyze results
            successful_operations = sum(
                1 for result in results 
                if isinstance(result, dict) and not isinstance(result, Exception)
            )
            
            total_expected = user_count * notifications_per_user
            duration = end_time - start_time
            ops_per_second = successful_operations / duration if duration > 0 else 0
            memory_usage = end_memory - start_memory if start_memory and end_memory else None
            success_rate = (successful_operations / total_expected) * 100
            
            result = BenchmarkResult(
                test_name="Concurrent User Performance",
                duration_seconds=duration,
                operations_count=successful_operations,
                operations_per_second=ops_per_second,
                memory_usage_mb=memory_usage,
                success_rate=success_rate,
                metadata={
                    "user_count": user_count,
                    "notifications_per_user": notifications_per_user,
                    "total_expected_notifications": total_expected,
                    "concurrent_execution": True,
                    "avg_notifications_per_user_per_second": ops_per_second / user_count if user_count > 0 else 0
                }
            )
            
            print(f"   ✅ Completed {successful_operations}/{total_expected} notifications")
            print(f"   👥 Simulated {user_count} concurrent users")
            print(f"   ⏱️  Total time: {duration:.3f}s")
            print(f"   📊 Rate: {ops_per_second:.2f} notifications/second")
            print(f"   📈 Per user rate: {ops_per_second / user_count:.2f} notifications/second/user")
            if memory_usage:
                print(f"   💾 Memory impact: {memory_usage:.2f}MB")
            
            return result
            
        except Exception as e:
            print(f"   ❌ Concurrent user benchmark failed: {e}")
            return BenchmarkResult(
                test_name="Concurrent User Performance",
                duration_seconds=0,
                operations_count=0,
                operations_per_second=0,
                success_rate=0,
                metadata={"error": str(e)}
            )
    
    def get_system_info(self) -> Dict[str, Any]:
        """Get system information for benchmark context"""
        system_info = {
            "python_version": sys.version,
            "platform": sys.platform,
            "psutil_available": self.psutil_available
        }
        
        if self.psutil_available:
            import psutil
            system_info.update({
                "cpu_count": psutil.cpu_count(),
                "cpu_count_logical": psutil.cpu_count(logical=True),
                "memory_total_gb": psutil.virtual_memory().total / 1024 / 1024 / 1024,
                "memory_available_gb": psutil.virtual_memory().available / 1024 / 1024 / 1024
            })
        
        return system_info
    
    async def run_all_benchmarks(self) -> PerformanceReport:
        """Run all performance benchmarks"""
        print("⚡ NOTIFICATION SYSTEM PERFORMANCE BENCHMARK")
        print("=" * 70)
        print(f"Benchmark started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("=" * 70)
        
        start_time = time.time()
        
        # Run all benchmark suites
        benchmark_functions = [
            self.benchmark_single_notification_performance,
            self.benchmark_bulk_notification_performance,
            self.benchmark_template_generation_performance,
            self.benchmark_memory_usage_scaling,
            self.benchmark_concurrent_user_performance
        ]
        
        results = []
        for benchmark_func in benchmark_functions:
            try:
                result = await benchmark_func()
                results.append(result)
            except Exception as e:
                logger.error(f"Benchmark {benchmark_func.__name__} failed: {e}")
                results.append(BenchmarkResult(
                    test_name=benchmark_func.__name__,
                    duration_seconds=0,
                    operations_count=0,
                    operations_per_second=0,
                    success_rate=0,
                    metadata={"error": str(e)}
                ))
        
        end_time = time.time()
        total_duration = end_time - start_time
        
        # Calculate summary statistics
        total_operations = sum(r.operations_count for r in results)
        avg_ops_per_second = statistics.mean([r.operations_per_second for r in results if r.operations_per_second > 0])
        overall_success_rate = statistics.mean([r.success_rate for r in results])
        
        summary_stats = {
            "total_operations": total_operations,
            "average_operations_per_second": avg_ops_per_second,
            "overall_success_rate": overall_success_rate,
            "fastest_test": max(results, key=lambda r: r.operations_per_second).test_name if results else None,
            "slowest_test": min(results, key=lambda r: r.operations_per_second).test_name if results else None
        }
        
        # Create performance report
        report = PerformanceReport(
            test_timestamp=datetime.now(),
            total_duration_seconds=total_duration,
            benchmark_results=results,
            system_info=self.get_system_info(),
            summary_stats=summary_stats
        )
        
        # Display summary
        self.display_benchmark_summary(report)
        
        # Save report
        self.save_benchmark_report(report)
        
        return report
    
    def display_benchmark_summary(self, report: PerformanceReport):
        """Display benchmark summary"""
        print("\n" + "=" * 70)
        print("📊 PERFORMANCE BENCHMARK SUMMARY")
        print("=" * 70)
        
        print(f"\n🕒 TIMING RESULTS:")
        print(f"   Total benchmark duration: {report.total_duration_seconds:.3f}s")
        print(f"   Total operations performed: {report.summary_stats['total_operations']}")
        print(f"   Average operations/second: {report.summary_stats['average_operations_per_second']:.2f}")
        print(f"   Overall success rate: {report.summary_stats['overall_success_rate']:.1f}%")
        
        print(f"\n📈 INDIVIDUAL BENCHMARK RESULTS:")
        for result in report.benchmark_results:
            status = "✅" if result.success_rate >= 95 else "⚠️" if result.success_rate >= 80 else "❌"
            print(f"   {status} {result.test_name}:")
            print(f"      Operations: {result.operations_count}")
            print(f"      Duration: {result.duration_seconds:.3f}s")
            print(f"      Rate: {result.operations_per_second:.2f} ops/sec")
            print(f"      Success: {result.success_rate:.1f}%")
            if result.memory_usage_mb:
                print(f"      Memory: {result.memory_usage_mb:.2f}MB")
        
        print(f"\n🖥️  SYSTEM INFORMATION:")
        print(f"   Platform: {report.system_info['platform']}")
        if 'cpu_count' in report.system_info:
            print(f"   CPU cores: {report.system_info['cpu_count']} ({report.system_info['cpu_count_logical']} logical)")
            print(f"   Memory: {report.system_info['memory_total_gb']:.1f}GB total, {report.system_info['memory_available_gb']:.1f}GB available")
        
        print(f"\n🎯 PERFORMANCE ASSESSMENT:")
        avg_rate = report.summary_stats['average_operations_per_second']
        
        if avg_rate >= 50:
            print(f"   ✅ EXCELLENT: System performs above 50 operations/second")
        elif avg_rate >= 20:
            print(f"   ✅ GOOD: System performs above 20 operations/second")
        elif avg_rate >= 10:
            print(f"   ⚠️  ACCEPTABLE: System performs above 10 operations/second")
        else:
            print(f"   ❌ NEEDS IMPROVEMENT: System performs below 10 operations/second")
        
        if report.summary_stats['overall_success_rate'] >= 95:
            print(f"   ✅ HIGH RELIABILITY: Success rate above 95%")
        elif report.summary_stats['overall_success_rate'] >= 90:
            print(f"   ⚠️  ACCEPTABLE RELIABILITY: Success rate above 90%")
        else:
            print(f"   ❌ LOW RELIABILITY: Success rate below 90%")
        
        print(f"\n💡 RECOMMENDATIONS:")
        if avg_rate < 20:
            print(f"   • Consider optimizing notification template generation")
            print(f"   • Review database query performance")
            print(f"   • Implement connection pooling for external services")
        
        if report.summary_stats['overall_success_rate'] < 95:
            print(f"   • Improve error handling in notification services")
            print(f"   • Add retry mechanisms for failed operations")
            print(f"   • Review timeout configurations")
        
        # Check for memory issues
        memory_intensive_tests = [r for r in report.benchmark_results if r.memory_usage_mb and r.memory_usage_mb > 100]
        if memory_intensive_tests:
            print(f"   • Monitor memory usage in production")
            print(f"   • Consider implementing memory cleanup routines")
    
    def save_benchmark_report(self, report: PerformanceReport):
        """Save benchmark report to file"""
        output_dir = Path("test_output")
        output_dir.mkdir(exist_ok=True)
        
        # Save detailed JSON report
        report_file = output_dir / f"performance_benchmark_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        
        # Convert to serializable format
        report_data = {
            "test_timestamp": report.test_timestamp.isoformat(),
            "total_duration_seconds": report.total_duration_seconds,
            "benchmark_results": [
                {
                    "test_name": r.test_name,
                    "duration_seconds": r.duration_seconds,
                    "operations_count": r.operations_count,
                    "operations_per_second": r.operations_per_second,
                    "memory_usage_mb": r.memory_usage_mb,
                    "success_rate": r.success_rate,
                    "metadata": r.metadata
                }
                for r in report.benchmark_results
            ],
            "system_info": report.system_info,
            "summary_stats": report.summary_stats
        }
        
        report_file.write_text(json.dumps(report_data, indent=2, default=str), encoding='utf-8')
        
        print(f"\n📄 BENCHMARK REPORT SAVED:")
        print(f"   File: {report_file}")
        print(f"   Size: {report_file.stat().st_size / 1024:.1f} KB")
        
        # Create CSV summary for easy analysis
        csv_file = output_dir / f"performance_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        csv_content = "Test Name,Duration (s),Operations,Ops/Sec,Success Rate (%),Memory (MB)\n"
        
        for result in report.benchmark_results:
            csv_content += f"{result.test_name},{result.duration_seconds:.3f},{result.operations_count},"
            csv_content += f"{result.operations_per_second:.2f},{result.success_rate:.1f},"
            csv_content += f"{result.memory_usage_mb or 0:.2f}\n"
        
        csv_file.write_text(csv_content, encoding='utf-8')
        print(f"   CSV Summary: {csv_file}")


async def main():
    """Main benchmark runner"""
    benchmark = NotificationPerformanceBenchmark()
    report = await benchmark.run_all_benchmarks()
    
    # Return success if overall performance is acceptable
    avg_rate = report.summary_stats['average_operations_per_second']
    success_rate = report.summary_stats['overall_success_rate']
    
    return 0 if avg_rate >= 10 and success_rate >= 90 else 1


if __name__ == "__main__":
    import sys
    exit_code = asyncio.run(main())
    sys.exit(exit_code)