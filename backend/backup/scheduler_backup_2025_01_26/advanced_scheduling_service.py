#!/usr/bin/env python3
"""
Advanced Scheduling Service

Provides comprehensive scheduling capabilities including:
- Calendar views with multiple perspectives (day, week, month)
- Work order scheduling and conflict detection
- Route optimization visualization
- Filter change integration
- Drag-and-drop rescheduling
- Capacity planning and load balancing
- Mobile-friendly views

Based on V1's scheduling interface with enhanced features.
"""

from datetime import datetime, date, timedelta, time
from typing import Dict, Any, List, Optional, Tuple, Set
from dataclasses import dataclass
from collections import defaultdict
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models.core_models import WorkOrder, User
from ..models.user_models import UserPreference
from ..services.logging_service import LoggingService
from ..services.work_order_service import WorkOrderService
from ..services.filter_scheduling_service import FilterSchedulingService
from ..services.user_management import UserManagementService


@dataclass
class ScheduleEvent:
    """Represents a scheduled event on the calendar"""
    event_id: str
    event_type: str  # work_order, filter_change, maintenance
    title: str
    description: Optional[str]
    start_time: datetime
    end_time: datetime
    location: Dict[str, Any]  # lat, lng, address
    priority: int  # 1-10
    status: str  # scheduled, in_progress, completed, cancelled
    assignee: Optional[str] = None
    color: Optional[str] = None  # Visual indicator
    metadata: Optional[Dict[str, Any]] = None


@dataclass
class ScheduleView:
    """Represents a calendar view configuration"""
    view_type: str  # day, week, month, agenda
    start_date: date
    end_date: date
    events: List[ScheduleEvent]
    filters: Dict[str, Any]
    summary: Dict[str, Any]


@dataclass
class ScheduleConflict:
    """Represents a scheduling conflict"""
    conflict_type: str  # time_overlap, location_conflict, capacity_exceeded
    severity: str  # warning, error
    events: List[ScheduleEvent]
    message: str
    resolution_options: List[Dict[str, Any]]


class AdvancedSchedulingService:
    """Service for advanced scheduling and calendar management"""
    
    # V1 Business Rules
    WORK_HOURS = {
        "start": time(7, 0),  # 7:00 AM
        "end": time(17, 0)   # 5:00 PM
    }
    
    # Time estimates (minutes)
    DEFAULT_WORK_ORDER_TIME = 120  # 2 hours
    TRAVEL_TIME_PER_MILE = 2  # Average including traffic
    BUFFER_TIME = 15  # Between appointments
    
    # Capacity limits
    MAX_DAILY_HOURS = 8
    MAX_DAILY_WORK_ORDERS = 4
    MAX_TRAVEL_DISTANCE = 150  # miles
    
    # Event colors
    EVENT_COLORS = {
        "work_order": "#4A90E2",  # Blue
        "filter_change": "#F5A623",  # Orange
        "maintenance": "#7ED321",  # Green
        "urgent": "#D0021B",  # Red
        "completed": "#9B9B9B"  # Gray
    }
    
    def __init__(self, db: Session):
        self.db = db
        self.logging_service = LoggingService(db)
        self.work_order_service = WorkOrderService(db)
        self.filter_scheduling_service = FilterSchedulingService(db)
        self.user_service = UserManagementService(db)
    
    async def get_calendar_view(
        self,
        user_id: str,
        view_type: str,
        start_date: date,
        filters: Optional[Dict[str, Any]] = None
    ) -> ScheduleView:
        """
        Get calendar view with events for specified period
        
        Supports day, week, month, and agenda views with
        filtering and summary statistics.
        """
        try:
            # Calculate date range based on view type
            end_date = self._calculate_view_end_date(start_date, view_type)
            
            # Get user preferences
            preferences = await self._get_user_scheduling_preferences(user_id)
            
            # Fetch events for period
            events = await self._fetch_events(
                user_id, start_date, end_date, filters
            )
            
            # Apply view-specific formatting
            formatted_events = self._format_events_for_view(
                events, view_type, preferences
            )
            
            # Calculate summary statistics
            summary = self._calculate_view_summary(formatted_events, view_type)
            
            # Create view object
            schedule_view = ScheduleView(
                view_type=view_type,
                start_date=start_date,
                end_date=end_date,
                events=formatted_events,
                filters=filters or {},
                summary=summary
            )
            
            await self.logging_service.log_info(
                f"Generated {view_type} view for user {user_id}: "
                f"{len(formatted_events)} events"
            )
            
            return schedule_view
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to generate calendar view: {str(e)}"
            )
            raise
    
    async def schedule_work_order(
        self,
        user_id: str,
        work_order_id: str,
        requested_date: date,
        requested_time: Optional[time] = None,
        duration_minutes: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Schedule a work order with conflict detection
        
        Finds optimal time slot considering existing appointments,
        travel time, and capacity constraints.
        """
        try:
            # Get work order details
            work_order = await self.work_order_service.get_work_order(work_order_id)
            
            if not work_order:
                raise ValueError(f"Work order {work_order_id} not found")
            
            # Estimate duration if not provided
            if not duration_minutes:
                duration_minutes = await self._estimate_work_order_duration(work_order)
            
            # Find available time slot
            if requested_time:
                # Check specific time
                start_time = datetime.combine(requested_date, requested_time)
                conflicts = await self._check_time_conflicts(
                    user_id, start_time, duration_minutes
                )
                
                if conflicts:
                    # Suggest alternatives
                    alternatives = await self._find_alternative_slots(
                        user_id, requested_date, duration_minutes
                    )
                    
                    return {
                        "status": "conflict",
                        "conflicts": conflicts,
                        "alternatives": alternatives
                    }
            else:
                # Find best available slot
                start_time = await self._find_optimal_slot(
                    user_id, requested_date, duration_minutes, work_order
                )
            
            # Create schedule event
            event = ScheduleEvent(
                event_id=f"wo_{work_order_id}",
                event_type="work_order",
                title=f"{work_order['station_name']} - {work_order['service_type']}",
                description=work_order.get("notes"),
                start_time=start_time,
                end_time=start_time + timedelta(minutes=duration_minutes),
                location={
                    "lat": work_order.get("latitude"),
                    "lng": work_order.get("longitude"),
                    "address": work_order.get("address")
                },
                priority=work_order.get("priority", 5),
                status="scheduled",
                assignee=user_id,
                color=self.EVENT_COLORS["work_order"],
                metadata={
                    "work_order_id": work_order_id,
                    "station_id": work_order.get("station_id"),
                    "service_codes": work_order.get("service_codes", [])
                }
            )
            
            # Save to database
            await self._save_schedule_event(event)
            
            # Update work order status
            await self.work_order_service.update_status(
                work_order_id, "scheduled", scheduled_date=start_time
            )
            
            return {
                "status": "success",
                "event": self._event_to_dict(event),
                "message": f"Scheduled for {start_time.strftime('%Y-%m-%d %I:%M %p')}"
            }
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to schedule work order: {str(e)}"
            )
            raise
    
    async def reschedule_event(
        self,
        event_id: str,
        new_date: date,
        new_time: Optional[time] = None,
        check_conflicts: bool = True
    ) -> Dict[str, Any]:
        """
        Reschedule an existing event
        
        Supports drag-and-drop rescheduling with automatic
        conflict detection and resolution.
        """
        try:
            # Get existing event
            event = await self._get_schedule_event(event_id)
            
            if not event:
                raise ValueError(f"Event {event_id} not found")
            
            # Calculate new times
            duration = (event.end_time - event.start_time).total_seconds() / 60
            
            if new_time:
                new_start = datetime.combine(new_date, new_time)
            else:
                # Keep same time of day
                new_start = datetime.combine(
                    new_date, 
                    event.start_time.time()
                )
            
            new_end = new_start + timedelta(minutes=duration)
            
            # Check conflicts if requested
            if check_conflicts:
                conflicts = await self._check_time_conflicts(
                    event.assignee,
                    new_start,
                    duration,
                    exclude_event_id=event_id
                )
                
                if conflicts:
                    return {
                        "status": "conflict",
                        "conflicts": conflicts,
                        "message": "Time slot has conflicts"
                    }
            
            # Update event
            event.start_time = new_start
            event.end_time = new_end
            
            await self._update_schedule_event(event)
            
            # Update related records
            if event.event_type == "work_order" and event.metadata:
                await self.work_order_service.update_status(
                    event.metadata["work_order_id"],
                    scheduled_date=new_start
                )
            
            return {
                "status": "success",
                "event": self._event_to_dict(event),
                "message": f"Rescheduled to {new_start.strftime('%Y-%m-%d %I:%M %p')}"
            }
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to reschedule event: {str(e)}"
            )
            raise
    
    async def optimize_daily_schedule(
        self,
        user_id: str,
        target_date: date
    ) -> Dict[str, Any]:
        """
        Optimize schedule for a specific day
        
        Reorders appointments to minimize travel time and
        maximize efficiency while respecting constraints.
        """
        try:
            # Get all events for the day
            events = await self._fetch_events(
                user_id,
                target_date,
                target_date,
                filters={"status": ["scheduled", "in_progress"]}
            )
            
            if len(events) <= 1:
                return {
                    "status": "no_optimization_needed",
                    "message": "Too few events to optimize"
                }
            
            # Extract locations
            locations = []
            for event in events:
                if event.location and event.location.get("lat"):
                    locations.append({
                        "event": event,
                        "lat": event.location["lat"],
                        "lng": event.location["lng"]
                    })
            
            # Optimize route
            if locations:
                optimized_order = await self._optimize_route_order(locations)
                
                # Reschedule events in optimized order
                current_time = datetime.combine(
                    target_date,
                    self.WORK_HOURS["start"]
                )
                
                rescheduled_events = []
                total_travel_time = 0
                
                for i, event_data in enumerate(optimized_order):
                    event = event_data["event"]
                    
                    # Add travel time if not first event
                    if i > 0:
                        travel_time = await self._calculate_travel_time(
                            optimized_order[i-1]["event"].location,
                            event.location
                        )
                        current_time += timedelta(minutes=travel_time)
                        total_travel_time += travel_time
                    
                    # Update event time
                    duration = (event.end_time - event.start_time).total_seconds() / 60
                    event.start_time = current_time
                    event.end_time = current_time + timedelta(minutes=duration)
                    
                    # Add buffer time
                    current_time = event.end_time + timedelta(minutes=self.BUFFER_TIME)
                    
                    rescheduled_events.append(event)
                
                # Save optimized schedule
                for event in rescheduled_events:
                    await self._update_schedule_event(event)
                
                return {
                    "status": "success",
                    "original_travel_time": await self._calculate_total_travel_time(events),
                    "optimized_travel_time": total_travel_time,
                    "time_saved": await self._calculate_total_travel_time(events) - total_travel_time,
                    "optimized_schedule": [
                        self._event_to_dict(e) for e in rescheduled_events
                    ]
                }
            
            return {
                "status": "no_location_data",
                "message": "Events lack location data for optimization"
            }
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to optimize schedule: {str(e)}"
            )
            raise
    
    async def get_availability(
        self,
        user_id: str,
        date_range_start: date,
        date_range_end: date,
        duration_minutes: int
    ) -> List[Dict[str, Any]]:
        """
        Find available time slots for scheduling
        
        Returns list of available slots that can accommodate
        the requested duration.
        """
        try:
            available_slots = []
            current_date = date_range_start
            
            while current_date <= date_range_end:
                # Skip weekends if configured
                if current_date.weekday() >= 5:  # Saturday or Sunday
                    preferences = await self._get_user_scheduling_preferences(user_id)
                    if not preferences.get("work_weekends", False):
                        current_date += timedelta(days=1)
                        continue
                
                # Get events for the day
                day_events = await self._fetch_events(
                    user_id, current_date, current_date
                )
                
                # Find gaps in schedule
                slots = self._find_time_gaps(
                    day_events,
                    current_date,
                    self.WORK_HOURS["start"],
                    self.WORK_HOURS["end"],
                    duration_minutes
                )
                
                available_slots.extend(slots)
                current_date += timedelta(days=1)
            
            return available_slots
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to get availability: {str(e)}"
            )
            raise
    
    async def bulk_schedule_filter_changes(
        self,
        user_id: str,
        filter_schedules: List[Dict[str, Any]],
        optimize_routes: bool = True
    ) -> Dict[str, Any]:
        """
        Schedule multiple filter changes efficiently
        
        Groups by location and optimizes routes to minimize
        travel time and maximize efficiency.
        """
        try:
            # Group filter changes by date and proximity
            grouped_changes = self._group_filter_changes(filter_schedules)
            
            scheduled_events = []
            optimization_results = []
            
            for date_key, changes in grouped_changes.items():
                if optimize_routes:
                    # Optimize order for the day
                    optimized_changes = await self._optimize_filter_route(changes)
                else:
                    optimized_changes = changes
                
                # Schedule each change
                current_time = datetime.combine(
                    date_key,
                    self.WORK_HOURS["start"]
                )
                
                for change in optimized_changes:
                    # Create event
                    event = ScheduleEvent(
                        event_id=f"fc_{change['station_id']}_{date_key}",
                        event_type="filter_change",
                        title=f"Filter Change - {change['station_name']}",
                        description=f"Filters: {', '.join(change['filters'].keys())}",
                        start_time=current_time,
                        end_time=current_time + timedelta(minutes=change['duration']),
                        location=change['location'],
                        priority=change.get('priority', 5),
                        status="scheduled",
                        assignee=user_id,
                        color=self.EVENT_COLORS["filter_change"],
                        metadata={
                            "station_id": change['station_id'],
                            "filters": change['filters']
                        }
                    )
                    
                    scheduled_events.append(event)
                    
                    # Update current time with travel
                    current_time = event.end_time + timedelta(minutes=self.BUFFER_TIME)
                
                if optimize_routes:
                    optimization_results.append({
                        "date": date_key.isoformat(),
                        "stations": len(optimized_changes),
                        "estimated_time": (current_time - datetime.combine(
                            date_key, self.WORK_HOURS["start"]
                        )).total_seconds() / 3600
                    })
            
            # Save all events
            for event in scheduled_events:
                await self._save_schedule_event(event)
            
            return {
                "status": "success",
                "scheduled_count": len(scheduled_events),
                "dates_affected": len(grouped_changes),
                "optimization_results": optimization_results,
                "events": [self._event_to_dict(e) for e in scheduled_events]
            }
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to bulk schedule filter changes: {str(e)}"
            )
            raise
    
    async def get_workload_analysis(
        self,
        user_id: str,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Analyze workload distribution and capacity
        
        Provides insights into scheduling efficiency and
        identifies over/under-utilized periods.
        """
        try:
            # Get all events for period
            events = await self._fetch_events(user_id, start_date, end_date)
            
            # Calculate daily workload
            daily_workload = defaultdict(lambda: {
                "work_hours": 0,
                "travel_hours": 0,
                "event_count": 0,
                "capacity_used": 0
            })
            
            # Group events by date
            events_by_date = defaultdict(list)
            for event in events:
                event_date = event.start_time.date()
                events_by_date[event_date].append(event)
            
            # Analyze each day
            for event_date, day_events in events_by_date.items():
                day_stats = daily_workload[event_date]
                
                # Calculate work hours
                for event in day_events:
                    duration = (event.end_time - event.start_time).total_seconds() / 3600
                    day_stats["work_hours"] += duration
                    day_stats["event_count"] += 1
                
                # Calculate travel time
                if len(day_events) > 1:
                    day_events.sort(key=lambda e: e.start_time)
                    for i in range(1, len(day_events)):
                        if day_events[i-1].location and day_events[i].location:
                            travel_time = await self._calculate_travel_time(
                                day_events[i-1].location,
                                day_events[i].location
                            )
                            day_stats["travel_hours"] += travel_time / 60
                
                # Calculate capacity usage
                total_hours = day_stats["work_hours"] + day_stats["travel_hours"]
                day_stats["capacity_used"] = (total_hours / self.MAX_DAILY_HOURS) * 100
            
            # Calculate period statistics
            total_work_hours = sum(d["work_hours"] for d in daily_workload.values())
            total_travel_hours = sum(d["travel_hours"] for d in daily_workload.values())
            total_events = sum(d["event_count"] for d in daily_workload.values())
            
            # Identify issues
            overbooked_days = [
                date for date, stats in daily_workload.items()
                if stats["capacity_used"] > 100
            ]
            
            underutilized_days = [
                date for date, stats in daily_workload.items()
                if stats["capacity_used"] < 50 and date.weekday() < 5
            ]
            
            return {
                "period": {
                    "start": start_date.isoformat(),
                    "end": end_date.isoformat(),
                    "total_days": (end_date - start_date).days + 1
                },
                "summary": {
                    "total_events": total_events,
                    "total_work_hours": round(total_work_hours, 1),
                    "total_travel_hours": round(total_travel_hours, 1),
                    "average_daily_hours": round(
                        (total_work_hours + total_travel_hours) / len(daily_workload) 
                        if daily_workload else 0, 1
                    ),
                    "efficiency_ratio": round(
                        total_work_hours / (total_work_hours + total_travel_hours) * 100
                        if (total_work_hours + total_travel_hours) > 0 else 0, 1
                    )
                },
                "issues": {
                    "overbooked_days": len(overbooked_days),
                    "underutilized_days": len(underutilized_days),
                    "dates_overbooked": [d.isoformat() for d in overbooked_days[:5]],
                    "dates_underutilized": [d.isoformat() for d in underutilized_days[:5]]
                },
                "daily_breakdown": [
                    {
                        "date": date.isoformat(),
                        "work_hours": round(stats["work_hours"], 1),
                        "travel_hours": round(stats["travel_hours"], 1),
                        "events": stats["event_count"],
                        "capacity_used": round(stats["capacity_used"], 1)
                    }
                    for date, stats in sorted(daily_workload.items())
                ]
            }
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to analyze workload: {str(e)}"
            )
            raise
    
    # Helper methods
    
    def _calculate_view_end_date(self, start_date: date, view_type: str) -> date:
        """Calculate end date based on view type"""
        if view_type == "day":
            return start_date
        elif view_type == "week":
            # End of week (Sunday)
            days_until_sunday = 6 - start_date.weekday()
            return start_date + timedelta(days=days_until_sunday)
        elif view_type == "month":
            # Last day of month
            if start_date.month == 12:
                return date(start_date.year + 1, 1, 1) - timedelta(days=1)
            else:
                return date(start_date.year, start_date.month + 1, 1) - timedelta(days=1)
        else:  # agenda
            return start_date + timedelta(days=30)  # 30 days ahead
    
    async def _get_user_scheduling_preferences(self, user_id: str) -> Dict[str, Any]:
        """Get user's scheduling preferences"""
        preferences = self.user_service.get_user_preference(user_id, "scheduling")
        
        return preferences or {
            "work_week_start": 1,  # Monday
            "work_week_end": 5,    # Friday
            "work_hours_start": "07:00",
            "work_hours_end": "17:00",
            "default_duration": 120,
            "travel_buffer": 15,
            "work_weekends": False
        }
    
    async def _fetch_events(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
        filters: Optional[Dict[str, Any]] = None
    ) -> List[ScheduleEvent]:
        """Fetch events from database"""
        # This would query actual schedule events
        # For now, return mock data
        return []
    
    def _format_events_for_view(
        self,
        events: List[ScheduleEvent],
        view_type: str,
        preferences: Dict[str, Any]
    ) -> List[ScheduleEvent]:
        """Format events based on view type"""
        formatted_events = []
        
        for event in events:
            # Apply view-specific formatting
            if view_type == "month":
                # Simplify for month view
                event.description = None  # Hide details
            
            # Apply color based on status/priority
            if event.status == "completed":
                event.color = self.EVENT_COLORS["completed"]
            elif event.priority >= 8:
                event.color = self.EVENT_COLORS["urgent"]
            
            formatted_events.append(event)
        
        return formatted_events
    
    def _calculate_view_summary(
        self,
        events: List[ScheduleEvent],
        view_type: str
    ) -> Dict[str, Any]:
        """Calculate summary statistics for view"""
        summary = {
            "total_events": len(events),
            "by_type": defaultdict(int),
            "by_status": defaultdict(int),
            "total_hours": 0
        }
        
        for event in events:
            summary["by_type"][event.event_type] += 1
            summary["by_status"][event.status] += 1
            
            duration = (event.end_time - event.start_time).total_seconds() / 3600
            summary["total_hours"] += duration
        
        summary["by_type"] = dict(summary["by_type"])
        summary["by_status"] = dict(summary["by_status"])
        summary["total_hours"] = round(summary["total_hours"], 1)
        
        return summary
    
    async def _estimate_work_order_duration(self, work_order: Dict[str, Any]) -> int:
        """Estimate duration for a work order"""
        # Base time
        duration = self.DEFAULT_WORK_ORDER_TIME
        
        # Adjust based on service type
        service_type = work_order.get("service_type", "").lower()
        if "comprehensive" in service_type:
            duration += 60
        elif "filter" in service_type:
            # Count dispensers
            dispenser_count = work_order.get("dispenser_count", 0)
            duration = 30 + (dispenser_count * 10)
        
        return duration
    
    async def _check_time_conflicts(
        self,
        user_id: str,
        start_time: datetime,
        duration_minutes: int,
        exclude_event_id: Optional[str] = None
    ) -> List[ScheduleConflict]:
        """Check for scheduling conflicts"""
        conflicts = []
        end_time = start_time + timedelta(minutes=duration_minutes)
        
        # Get events for the day
        events = await self._fetch_events(
            user_id,
            start_time.date(),
            start_time.date()
        )
        
        for event in events:
            if exclude_event_id and event.event_id == exclude_event_id:
                continue
            
            # Check time overlap
            if (event.start_time < end_time and event.end_time > start_time):
                conflicts.append(ScheduleConflict(
                    conflict_type="time_overlap",
                    severity="error",
                    events=[event],
                    message=f"Overlaps with {event.title}",
                    resolution_options=[
                        {"action": "reschedule_new", "description": "Pick different time"},
                        {"action": "reschedule_existing", "description": f"Move {event.title}"}
                    ]
                ))
        
        return conflicts
    
    async def _find_alternative_slots(
        self,
        user_id: str,
        target_date: date,
        duration_minutes: int,
        max_alternatives: int = 3
    ) -> List[Dict[str, Any]]:
        """Find alternative time slots"""
        alternatives = []
        
        # Check same day first
        same_day_slots = await self.get_availability(
            user_id, target_date, target_date, duration_minutes
        )
        
        alternatives.extend(same_day_slots[:max_alternatives])
        
        # If need more, check nearby days
        if len(alternatives) < max_alternatives:
            nearby_slots = await self.get_availability(
                user_id,
                target_date - timedelta(days=1),
                target_date + timedelta(days=3),
                duration_minutes
            )
            
            for slot in nearby_slots:
                if slot not in alternatives:
                    alternatives.append(slot)
                    if len(alternatives) >= max_alternatives:
                        break
        
        return alternatives
    
    async def _find_optimal_slot(
        self,
        user_id: str,
        target_date: date,
        duration_minutes: int,
        work_order: Dict[str, Any]
    ) -> datetime:
        """Find optimal time slot considering various factors"""
        # Get available slots
        slots = await self.get_availability(
            user_id, target_date, target_date, duration_minutes
        )
        
        if not slots:
            raise ValueError("No available slots on requested date")
        
        # Score each slot
        scored_slots = []
        for slot in slots:
            score = 100  # Base score
            
            # Prefer morning slots
            if slot["start_time"].hour < 12:
                score += 10
            
            # Check travel efficiency
            # (would calculate based on other appointments)
            
            scored_slots.append((score, slot))
        
        # Sort by score
        scored_slots.sort(key=lambda x: x[0], reverse=True)
        
        return scored_slots[0][1]["start_time"]
    
    def _find_time_gaps(
        self,
        events: List[ScheduleEvent],
        target_date: date,
        work_start: time,
        work_end: time,
        min_duration: int
    ) -> List[Dict[str, Any]]:
        """Find gaps in schedule that can fit requested duration"""
        gaps = []
        
        # Sort events by start time
        events.sort(key=lambda e: e.start_time)
        
        # Check gap before first event
        day_start = datetime.combine(target_date, work_start)
        if not events or events[0].start_time > day_start + timedelta(minutes=min_duration):
            gap_end = events[0].start_time if events else datetime.combine(target_date, work_end)
            gap_duration = (gap_end - day_start).total_seconds() / 60
            
            if gap_duration >= min_duration:
                gaps.append({
                    "start_time": day_start,
                    "end_time": gap_end,
                    "duration": gap_duration
                })
        
        # Check gaps between events
        for i in range(len(events) - 1):
            gap_start = events[i].end_time
            gap_end = events[i + 1].start_time
            gap_duration = (gap_end - gap_start).total_seconds() / 60
            
            if gap_duration >= min_duration:
                gaps.append({
                    "start_time": gap_start,
                    "end_time": gap_end,
                    "duration": gap_duration
                })
        
        # Check gap after last event
        day_end = datetime.combine(target_date, work_end)
        if events and events[-1].end_time < day_end - timedelta(minutes=min_duration):
            gap_duration = (day_end - events[-1].end_time).total_seconds() / 60
            
            if gap_duration >= min_duration:
                gaps.append({
                    "start_time": events[-1].end_time,
                    "end_time": day_end,
                    "duration": gap_duration
                })
        
        return gaps
    
    def _event_to_dict(self, event: ScheduleEvent) -> Dict[str, Any]:
        """Convert event to dictionary"""
        return {
            "id": event.event_id,
            "type": event.event_type,
            "title": event.title,
            "description": event.description,
            "start": event.start_time.isoformat(),
            "end": event.end_time.isoformat(),
            "location": event.location,
            "priority": event.priority,
            "status": event.status,
            "assignee": event.assignee,
            "color": event.color,
            "metadata": event.metadata
        }
    
    async def _save_schedule_event(self, event: ScheduleEvent):
        """Save event to database"""
        # Would save to actual database
        pass
    
    async def _get_schedule_event(self, event_id: str) -> Optional[ScheduleEvent]:
        """Get event from database"""
        # Would query actual database
        return None
    
    async def _update_schedule_event(self, event: ScheduleEvent):
        """Update event in database"""
        # Would update actual database
        pass
    
    async def _calculate_travel_time(
        self,
        from_location: Dict[str, float],
        to_location: Dict[str, float]
    ) -> int:
        """Calculate travel time between locations in minutes"""
        if not from_location or not to_location:
            return 0
        
        # Calculate distance using haversine formula
        from ..services.filter_scheduling_service import FilterSchedulingService
        distance = FilterSchedulingService._calculate_distance(
            None, from_location, to_location
        )
        
        # Convert to time
        return int(distance * self.TRAVEL_TIME_PER_MILE)
    
    async def _calculate_total_travel_time(
        self,
        events: List[ScheduleEvent]
    ) -> int:
        """Calculate total travel time for a list of events"""
        if len(events) <= 1:
            return 0
        
        total_time = 0
        events.sort(key=lambda e: e.start_time)
        
        for i in range(1, len(events)):
            if events[i-1].location and events[i].location:
                travel_time = await self._calculate_travel_time(
                    events[i-1].location,
                    events[i].location
                )
                total_time += travel_time
        
        return total_time
    
    async def _optimize_route_order(
        self,
        locations: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Optimize order of locations to minimize travel"""
        # Simple nearest neighbor algorithm
        if len(locations) <= 2:
            return locations
        
        optimized = [locations[0]]
        remaining = locations[1:]
        
        while remaining:
            current = optimized[-1]
            nearest = min(
                remaining,
                key=lambda loc: FilterSchedulingService._calculate_distance(
                    None,
                    {"lat": current["lat"], "lng": current["lng"]},
                    {"lat": loc["lat"], "lng": loc["lng"]}
                )
            )
            optimized.append(nearest)
            remaining.remove(nearest)
        
        return optimized
    
    def _group_filter_changes(
        self,
        filter_schedules: List[Dict[str, Any]]
    ) -> Dict[date, List[Dict[str, Any]]]:
        """Group filter changes by date"""
        groups = defaultdict(list)
        
        for schedule in filter_schedules:
            change_date = schedule["scheduled_date"]
            if isinstance(change_date, str):
                change_date = date.fromisoformat(change_date)
            
            groups[change_date].append(schedule)
        
        return groups
    
    async def _optimize_filter_route(
        self,
        changes: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """Optimize route for filter changes"""
        # Convert to location format
        locations = []
        for change in changes:
            if change.get("location"):
                locations.append({
                    "event": change,
                    "lat": change["location"]["lat"],
                    "lng": change["location"]["lng"]
                })
        
        if not locations:
            return changes
        
        # Optimize
        optimized = await self._optimize_route_order(locations)
        
        return [loc["event"] for loc in optimized]