#!/usr/bin/env python3
"""
Automation Job Queue Management System
Provides sophisticated job scheduling, queuing, and resource management
"""

import asyncio
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from pathlib import Path
import heapq
from collections import defaultdict
import threading

logger = logging.getLogger(__name__)

class JobPriority(Enum):
    """Job priority levels"""
    LOW = 1
    NORMAL = 2
    HIGH = 3
    URGENT = 4
    CRITICAL = 5

class JobStatus(Enum):
    """Job status states"""
    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"

class QueueType(Enum):
    """Queue types for different automation tasks"""
    SINGLE_VISIT = "single_visit"
    BATCH_PROCESSING = "batch_processing"
    SCHEDULED_TASK = "scheduled_task"
    RETRY_QUEUE = "retry_queue"
    PRIORITY_QUEUE = "priority_queue"

@dataclass
class JobResource:
    """Resource requirements for a job"""
    browser_sessions: int = 1
    memory_mb: int = 512
    cpu_cores: float = 0.5
    max_duration_minutes: int = 30
    network_bandwidth_mbps: float = 10.0

@dataclass
class QueueJob:
    """Job in the automation queue"""
    job_id: str
    user_id: str
    job_type: str
    priority: JobPriority
    status: JobStatus
    queue_type: QueueType
    
    # Job data
    work_order_id: Optional[str] = None
    visit_url: Optional[str] = None
    dispensers: List[Dict[str, Any]] = None
    batch_data: Optional[Dict[str, Any]] = None
    
    # Scheduling
    scheduled_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    max_retries: int = 3
    retry_delay_seconds: int = 60
    
    # Resources
    resource_requirements: JobResource = None
    
    # Tracking
    created_at: datetime = None
    queued_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    
    # Results
    result_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None
    retry_count: int = 0
    execution_time_seconds: float = 0.0
    
    # Dependencies
    depends_on: List[str] = None  # Job IDs this job depends on
    dependency_mode: str = "all"  # "all" or "any"
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
        if self.dispensers is None:
            self.dispensers = []
        if self.depends_on is None:
            self.depends_on = []
        if self.resource_requirements is None:
            self.resource_requirements = JobResource()
    
    def __lt__(self, other):
        """For priority queue ordering"""
        # Higher priority values come first
        if self.priority.value != other.priority.value:
            return self.priority.value > other.priority.value
        # Earlier scheduled times come first
        if self.scheduled_at and other.scheduled_at:
            return self.scheduled_at < other.scheduled_at
        # Earlier creation times come first
        return self.created_at < other.created_at

@dataclass
class QueueMetrics:
    """Queue performance metrics"""
    total_jobs: int = 0
    pending_jobs: int = 0
    running_jobs: int = 0
    completed_jobs: int = 0
    failed_jobs: int = 0
    average_execution_time: float = 0.0
    average_wait_time: float = 0.0
    resource_utilization: Dict[str, float] = None
    throughput_per_hour: float = 0.0
    
    def __post_init__(self):
        if self.resource_utilization is None:
            self.resource_utilization = {
                'browser_sessions': 0.0,
                'memory_mb': 0.0,
                'cpu_cores': 0.0
            }

class ResourceManager:
    """Manages available resources for job execution"""
    
    def __init__(self, max_browser_sessions: int = 5, max_memory_mb: int = 4096, max_cpu_cores: float = 4.0):
        self.max_browser_sessions = max_browser_sessions
        self.max_memory_mb = max_memory_mb
        self.max_cpu_cores = max_cpu_cores
        
        self.allocated_browser_sessions = 0
        self.allocated_memory_mb = 0
        self.allocated_cpu_cores = 0.0
        
        self.job_allocations: Dict[str, JobResource] = {}
        self._lock = threading.Lock()
    
    def can_allocate(self, resources: JobResource) -> bool:
        """Check if resources can be allocated"""
        with self._lock:
            return (
                self.allocated_browser_sessions + resources.browser_sessions <= self.max_browser_sessions and
                self.allocated_memory_mb + resources.memory_mb <= self.max_memory_mb and
                self.allocated_cpu_cores + resources.cpu_cores <= self.max_cpu_cores
            )
    
    def allocate(self, job_id: str, resources: JobResource) -> bool:
        """Allocate resources for a job"""
        with self._lock:
            if self.can_allocate(resources):
                self.allocated_browser_sessions += resources.browser_sessions
                self.allocated_memory_mb += resources.memory_mb
                self.allocated_cpu_cores += resources.cpu_cores
                self.job_allocations[job_id] = resources
                return True
            return False
    
    def deallocate(self, job_id: str) -> bool:
        """Deallocate resources for a job"""
        with self._lock:
            if job_id in self.job_allocations:
                resources = self.job_allocations[job_id]
                self.allocated_browser_sessions -= resources.browser_sessions
                self.allocated_memory_mb -= resources.memory_mb
                self.allocated_cpu_cores -= resources.cpu_cores
                del self.job_allocations[job_id]
                return True
            return False
    
    def get_utilization(self) -> Dict[str, float]:
        """Get current resource utilization percentages"""
        with self._lock:
            return {
                'browser_sessions': (self.allocated_browser_sessions / self.max_browser_sessions) * 100,
                'memory_mb': (self.allocated_memory_mb / self.max_memory_mb) * 100,
                'cpu_cores': (self.allocated_cpu_cores / self.max_cpu_cores) * 100
            }

class JobQueueManager:
    """Main job queue management system"""
    
    def __init__(self, storage_path: Optional[str] = None):
        self.storage_path = storage_path or self._get_default_storage_path()
        
        # Job storage
        self.jobs: Dict[str, QueueJob] = {}
        self.priority_queues: Dict[QueueType, List[QueueJob]] = {
            queue_type: [] for queue_type in QueueType
        }
        
        # Resource management
        self.resource_manager = ResourceManager()
        
        # Event callbacks
        self.job_callbacks: List[Callable] = []
        self.status_callbacks: List[Callable] = []
        
        # Queue processing
        self.is_processing = False
        self.processing_task: Optional[asyncio.Task] = None
        self.max_concurrent_jobs = 3
        self.running_jobs: Dict[str, asyncio.Task] = {}
        
        # Metrics
        self.metrics = QueueMetrics()
        self.metrics_history: List[QueueMetrics] = []
        
        # Configuration
        self.config = {
            'queue_check_interval': 5,  # seconds
            'metrics_update_interval': 60,  # seconds
            'job_timeout_minutes': 30,
            'max_queue_size': 1000,
            'auto_retry_failed_jobs': True,
            'cleanup_completed_jobs_hours': 24
        }
        
        self._ensure_storage_directory()
        self._load_persisted_jobs()
    
    def _get_default_storage_path(self) -> str:
        """Get default storage path for job persistence"""
        base_dir = Path(__file__).parent.parent.parent / "data" / "job_queue"
        return str(base_dir)
    
    def _ensure_storage_directory(self):
        """Ensure job storage directory exists"""
        Path(self.storage_path).mkdir(parents=True, exist_ok=True)
    
    def _load_persisted_jobs(self):
        """Load persisted jobs from storage"""
        try:
            jobs_file = Path(self.storage_path) / "jobs.json"
            if jobs_file.exists():
                with open(jobs_file, 'r') as f:
                    jobs_data = json.load(f)
                    
                for job_data in jobs_data:
                    # Deserialize job
                    job = self._deserialize_job(job_data)
                    if job and job.status in [JobStatus.PENDING, JobStatus.QUEUED, JobStatus.RUNNING]:
                        # Reset running jobs to queued
                        if job.status == JobStatus.RUNNING:
                            job.status = JobStatus.QUEUED
                        self.jobs[job.job_id] = job
                        self._add_to_priority_queue(job)
                
                logger.info(f"Loaded {len(self.jobs)} persisted jobs")
        except Exception as e:
            logger.error(f"Failed to load persisted jobs: {e}")
    
    def _persist_jobs(self):
        """Persist jobs to storage"""
        try:
            jobs_file = Path(self.storage_path) / "jobs.json"
            jobs_data = [self._serialize_job(job) for job in self.jobs.values()]
            
            with open(jobs_file, 'w') as f:
                json.dump(jobs_data, f, indent=2, default=str)
        except Exception as e:
            logger.error(f"Failed to persist jobs: {e}")
    
    def _serialize_job(self, job: QueueJob) -> Dict[str, Any]:
        """Serialize job to dictionary"""
        job_dict = asdict(job)
        # Convert enums to strings
        job_dict['priority'] = job.priority.value
        job_dict['status'] = job.status.value
        job_dict['queue_type'] = job.queue_type.value
        return job_dict
    
    def _deserialize_job(self, job_data: Dict[str, Any]) -> Optional[QueueJob]:
        """Deserialize job from dictionary"""
        try:
            # Convert string enums back to enum objects
            job_data['priority'] = JobPriority(job_data['priority'])
            job_data['status'] = JobStatus(job_data['status'])
            job_data['queue_type'] = QueueType(job_data['queue_type'])
            
            # Convert datetime strings back to datetime objects
            for field in ['created_at', 'queued_at', 'started_at', 'completed_at', 'scheduled_at', 'deadline']:
                if job_data.get(field):
                    job_data[field] = datetime.fromisoformat(job_data[field])
            
            # Create JobResource object
            if job_data.get('resource_requirements'):
                job_data['resource_requirements'] = JobResource(**job_data['resource_requirements'])
            
            return QueueJob(**job_data)
        except Exception as e:
            logger.error(f"Failed to deserialize job: {e}")
            return None
    
    def _add_to_priority_queue(self, job: QueueJob):
        """Add job to appropriate priority queue"""
        heapq.heappush(self.priority_queues[job.queue_type], job)
    
    def add_job_callback(self, callback: Callable):
        """Add callback for job events"""
        self.job_callbacks.append(callback)
    
    def add_status_callback(self, callback: Callable):
        """Add callback for status updates"""
        self.status_callbacks.append(callback)
    
    async def _emit_job_event(self, event_type: str, job: QueueJob, data: Optional[Dict[str, Any]] = None):
        """Emit job event to callbacks"""
        event_data = {
            'event_type': event_type,
            'job_id': job.job_id,
            'user_id': job.user_id,
            'status': job.status.value,
            'timestamp': datetime.now().isoformat(),
            'data': data or {}
        }
        
        for callback in self.job_callbacks:
            try:
                await callback(event_data)
            except Exception as e:
                logger.error(f"Job callback error: {e}")
    
    async def submit_job(self, job: QueueJob) -> str:
        """Submit a job to the queue"""
        try:
            # Validate job
            if len(self.jobs) >= self.config['max_queue_size']:
                raise Exception("Queue is full")
            
            if job.job_id in self.jobs:
                raise Exception(f"Job {job.job_id} already exists")
            
            # Set job status and timing
            job.status = JobStatus.QUEUED
            job.queued_at = datetime.now()
            
            # Store job
            self.jobs[job.job_id] = job
            self._add_to_priority_queue(job)
            
            # Update metrics
            self.metrics.total_jobs += 1
            self.metrics.pending_jobs += 1
            
            # Persist changes
            self._persist_jobs()
            
            # Emit event
            await self._emit_job_event('job_queued', job)
            
            logger.info(f"Job {job.job_id} submitted to {job.queue_type.value} queue")
            
            # Start queue processing if not already running
            if not self.is_processing:
                await self.start_processing()
            
            return job.job_id
            
        except Exception as e:
            logger.error(f"Failed to submit job {job.job_id}: {e}")
            raise
    
    async def start_processing(self):
        """Start queue processing"""
        if self.is_processing:
            return
        
        self.is_processing = True
        self.processing_task = asyncio.create_task(self._process_queues())
        logger.info("Job queue processing started")
    
    async def stop_processing(self):
        """Stop queue processing"""
        self.is_processing = False
        
        if self.processing_task:
            self.processing_task.cancel()
            try:
                await self.processing_task
            except asyncio.CancelledError:
                pass
        
        # Wait for running jobs to complete or cancel them
        if self.running_jobs:
            logger.info(f"Waiting for {len(self.running_jobs)} running jobs to complete...")
            await asyncio.gather(*self.running_jobs.values(), return_exceptions=True)
        
        logger.info("Job queue processing stopped")
    
    async def _process_queues(self):
        """Main queue processing loop"""
        while self.is_processing:
            try:
                # Process each queue type
                for queue_type in QueueType:
                    await self._process_queue(queue_type)
                
                # Update metrics
                await self._update_metrics()
                
                # Cleanup completed jobs
                await self._cleanup_old_jobs()
                
                # Wait before next iteration
                await asyncio.sleep(self.config['queue_check_interval'])
                
            except Exception as e:
                logger.error(f"Queue processing error: {e}")
                await asyncio.sleep(5)  # Wait before retrying
    
    async def _process_queue(self, queue_type: QueueType):
        """Process a specific queue type"""
        queue = self.priority_queues[queue_type]
        
        while queue and len(self.running_jobs) < self.max_concurrent_jobs:
            # Get next job
            job = heapq.heappop(queue)
            
            # Check if job is still valid
            if job.job_id not in self.jobs or job.status != JobStatus.QUEUED:
                continue
            
            # Check dependencies
            if not await self._check_dependencies(job):
                # Re-queue job for later
                heapq.heappush(queue, job)
                break
            
            # Check if scheduled time has arrived
            if job.scheduled_at and job.scheduled_at > datetime.now():
                # Re-queue job for later
                heapq.heappush(queue, job)
                break
            
            # Check resources
            if not self.resource_manager.can_allocate(job.resource_requirements):
                # Re-queue job for later
                heapq.heappush(queue, job)
                break
            
            # Allocate resources and start job
            if self.resource_manager.allocate(job.job_id, job.resource_requirements):
                task = asyncio.create_task(self._execute_job(job))
                self.running_jobs[job.job_id] = task
                
                job.status = JobStatus.RUNNING
                job.started_at = datetime.now()
                
                await self._emit_job_event('job_started', job)
                logger.info(f"Started job {job.job_id}")
    
    async def _check_dependencies(self, job: QueueJob) -> bool:
        """Check if job dependencies are satisfied"""
        if not job.depends_on:
            return True
        
        completed_dependencies = 0
        for dep_job_id in job.depends_on:
            if dep_job_id in self.jobs:
                dep_job = self.jobs[dep_job_id]
                if dep_job.status == JobStatus.COMPLETED:
                    completed_dependencies += 1
                elif dep_job.status == JobStatus.FAILED:
                    if job.dependency_mode == "all":
                        return False
        
        if job.dependency_mode == "all":
            return completed_dependencies == len(job.depends_on)
        else:  # "any"
            return completed_dependencies > 0
    
    async def _execute_job(self, job: QueueJob):
        """Execute a job"""
        try:
            start_time = datetime.now()
            
            # Import and execute based on job type
            if job.job_type == "single_visit":
                await self._execute_single_visit_job(job)
            elif job.job_type == "batch_processing":
                await self._execute_batch_job(job)
            else:
                raise Exception(f"Unknown job type: {job.job_type}")
            
            # Calculate execution time
            execution_time = (datetime.now() - start_time).total_seconds()
            job.execution_time_seconds = execution_time
            job.status = JobStatus.COMPLETED
            job.completed_at = datetime.now()
            
            # Update metrics
            self.metrics.completed_jobs += 1
            self.metrics.pending_jobs = max(0, self.metrics.pending_jobs - 1)
            
            await self._emit_job_event('job_completed', job, {
                'execution_time_seconds': execution_time
            })
            
            logger.info(f"Job {job.job_id} completed in {execution_time:.2f}s")
            
        except Exception as e:
            job.status = JobStatus.FAILED
            job.error_message = str(e)
            job.completed_at = datetime.now()
            
            # Update metrics
            self.metrics.failed_jobs += 1
            self.metrics.pending_jobs = max(0, self.metrics.pending_jobs - 1)
            
            await self._emit_job_event('job_failed', job, {
                'error_message': str(e)
            })
            
            logger.error(f"Job {job.job_id} failed: {e}")
            
            # Handle retries
            if job.retry_count < job.max_retries and self.config['auto_retry_failed_jobs']:
                await self._schedule_retry(job)
        
        finally:
            # Cleanup
            self.resource_manager.deallocate(job.job_id)
            if job.job_id in self.running_jobs:
                del self.running_jobs[job.job_id]
            self._persist_jobs()
    
    async def _execute_single_visit_job(self, job: QueueJob):
        """Execute single visit automation job"""
        from .form_automation import form_automation_service
        
        await form_automation_service.process_visit(
            user_id=job.user_id,
            visit_url=job.visit_url,
            work_order_id=job.work_order_id,
            dispensers=job.dispensers,
            options={}
        )
    
    async def _execute_batch_job(self, job: QueueJob):
        """Execute batch processing job"""
        from .form_automation import form_automation_service
        
        await form_automation_service.process_batch(
            user_id=job.user_id,
            batch_data=job.batch_data.get('visits', []),
            options=job.batch_data.get('options', {})
        )
    
    async def _schedule_retry(self, job: QueueJob):
        """Schedule job for retry"""
        job.retry_count += 1
        job.status = JobStatus.QUEUED
        job.scheduled_at = datetime.now() + timedelta(seconds=job.retry_delay_seconds)
        job.error_message = None
        
        # Add back to queue
        self._add_to_priority_queue(job)
        
        await self._emit_job_event('job_retry_scheduled', job, {
            'retry_count': job.retry_count,
            'scheduled_at': job.scheduled_at.isoformat()
        })
        
        logger.info(f"Job {job.job_id} scheduled for retry {job.retry_count}/{job.max_retries}")
    
    async def _update_metrics(self):
        """Update queue metrics"""
        running_count = len(self.running_jobs)
        pending_count = sum(len(queue) for queue in self.priority_queues.values())
        
        self.metrics.running_jobs = running_count
        self.metrics.pending_jobs = pending_count
        self.metrics.resource_utilization = self.resource_manager.get_utilization()
        
        # Calculate average execution time
        completed_jobs = [job for job in self.jobs.values() if job.status == JobStatus.COMPLETED]
        if completed_jobs:
            total_time = sum(job.execution_time_seconds for job in completed_jobs)
            self.metrics.average_execution_time = total_time / len(completed_jobs)
        
        # Store metrics history
        self.metrics_history.append(self.metrics)
        
        # Keep only last 24 hours of metrics
        cutoff_time = datetime.now() - timedelta(hours=24)
        self.metrics_history = [m for m in self.metrics_history if getattr(m, 'timestamp', datetime.now()) > cutoff_time]
    
    async def _cleanup_old_jobs(self):
        """Clean up old completed jobs"""
        cutoff_time = datetime.now() - timedelta(hours=self.config['cleanup_completed_jobs_hours'])
        
        jobs_to_remove = []
        for job_id, job in self.jobs.items():
            if (job.status in [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED] and 
                job.completed_at and job.completed_at < cutoff_time):
                jobs_to_remove.append(job_id)
        
        for job_id in jobs_to_remove:
            del self.jobs[job_id]
        
        if jobs_to_remove:
            logger.info(f"Cleaned up {len(jobs_to_remove)} old jobs")
            self._persist_jobs()
    
    async def cancel_job(self, job_id: str) -> bool:
        """Cancel a job"""
        if job_id not in self.jobs:
            return False
        
        job = self.jobs[job_id]
        
        if job.status == JobStatus.RUNNING:
            # Cancel running task
            if job_id in self.running_jobs:
                self.running_jobs[job_id].cancel()
                del self.running_jobs[job_id]
            self.resource_manager.deallocate(job_id)
        
        job.status = JobStatus.CANCELLED
        job.completed_at = datetime.now()
        
        await self._emit_job_event('job_cancelled', job)
        self._persist_jobs()
        
        return True
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get job status"""
        if job_id not in self.jobs:
            return None
        
        job = self.jobs[job_id]
        return {
            'job_id': job.job_id,
            'status': job.status.value,
            'priority': job.priority.value,
            'queue_type': job.queue_type.value,
            'created_at': job.created_at.isoformat(),
            'queued_at': job.queued_at.isoformat() if job.queued_at else None,
            'started_at': job.started_at.isoformat() if job.started_at else None,
            'completed_at': job.completed_at.isoformat() if job.completed_at else None,
            'execution_time_seconds': job.execution_time_seconds,
            'retry_count': job.retry_count,
            'error_message': job.error_message,
            'resource_requirements': asdict(job.resource_requirements)
        }
    
    def get_queue_status(self) -> Dict[str, Any]:
        """Get overall queue status"""
        return {
            'metrics': asdict(self.metrics),
            'resource_utilization': self.resource_manager.get_utilization(),
            'queue_sizes': {
                queue_type.value: len(queue) 
                for queue_type, queue in self.priority_queues.items()
            },
            'running_jobs': len(self.running_jobs),
            'total_jobs': len(self.jobs),
            'is_processing': self.is_processing,
            'config': self.config
        }

# Global job queue manager instance
job_queue_manager = JobQueueManager()

# Helper functions for creating common job types
def create_single_visit_job(user_id: str, work_order_id: str, visit_url: str, 
                          dispensers: List[Dict[str, Any]], priority: JobPriority = JobPriority.NORMAL) -> QueueJob:
    """Create a single visit automation job"""
    return QueueJob(
        job_id=str(uuid.uuid4()),
        user_id=user_id,
        job_type="single_visit",
        priority=priority,
        status=JobStatus.PENDING,
        queue_type=QueueType.SINGLE_VISIT,
        work_order_id=work_order_id,
        visit_url=visit_url,
        dispensers=dispensers,
        resource_requirements=JobResource(
            browser_sessions=1,
            memory_mb=512,
            cpu_cores=0.5,
            max_duration_minutes=30
        )
    )

def create_batch_processing_job(user_id: str, batch_data: Dict[str, Any], 
                              priority: JobPriority = JobPriority.NORMAL) -> QueueJob:
    """Create a batch processing job"""
    visits = batch_data.get('visits', [])
    total_dispensers = sum(len(visit.get('dispensers', [])) for visit in visits)
    
    return QueueJob(
        job_id=str(uuid.uuid4()),
        user_id=user_id,
        job_type="batch_processing",
        priority=priority,
        status=JobStatus.PENDING,
        queue_type=QueueType.BATCH_PROCESSING,
        batch_data=batch_data,
        resource_requirements=JobResource(
            browser_sessions=min(3, len(visits)),  # Scale with batch size
            memory_mb=512 + (total_dispensers * 50),  # More memory for larger batches
            cpu_cores=0.5 + (len(visits) * 0.1),  # Scale CPU with visits
            max_duration_minutes=10 + (len(visits) * 5)  # 5 minutes per visit
        )
    )

# Testing function
async def test_job_queue():
    """Test job queue functionality"""
    print("[SYNC] Testing Job Queue Manager...")
    
    try:
        # Create test jobs
        job1 = create_single_visit_job(
            user_id="test_user",
            work_order_id="WO-001",
            visit_url="https://app.workfossa.com/visit/123",
            dispensers=[{"dispenser_number": "1", "fuel_grades": {"regular": {}}}],
            priority=JobPriority.HIGH
        )
        
        job2 = create_batch_processing_job(
            user_id="test_user",
            batch_data={
                "visits": [
                    {"work_order_id": "WO-002", "dispensers": [{"dispenser_number": "1"}]},
                    {"work_order_id": "WO-003", "dispensers": [{"dispenser_number": "2"}]}
                ]
            }
        )
        
        # Submit jobs
        job_id1 = await job_queue_manager.submit_job(job1)
        job_id2 = await job_queue_manager.submit_job(job2)
        
        print(f"  [OK] Submitted jobs: {job_id1}, {job_id2}")
        
        # Check status
        status1 = job_queue_manager.get_job_status(job_id1)
        queue_status = job_queue_manager.get_queue_status()
        
        print(f"  [OK] Job status: {status1['status']}")
        print(f"  [OK] Queue metrics: {queue_status['metrics']['total_jobs']} total jobs")
        print(f"  [OK] Resource utilization: {queue_status['resource_utilization']}")
        
        # Stop processing
        await job_queue_manager.stop_processing()
        
        print("[SUCCESS] Job Queue Manager tests completed!")
        return True
        
    except Exception as e:
        print(f"  [ERROR] Test failed: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_job_queue())