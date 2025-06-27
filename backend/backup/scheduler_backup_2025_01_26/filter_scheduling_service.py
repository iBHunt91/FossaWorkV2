#!/usr/bin/env python3
"""
Filter Change Scheduling Service

Optimizes filter change scheduling by analyzing work order patterns,
geographic locations, and filter life cycles to minimize truck rolls
and maximize efficiency.

Based on V1's scheduling logic that groups filter changes by:
- Geographic proximity
- Filter change intervals
- Work week patterns
- Station-specific requirements
"""

import uuid
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple, Set
from dataclasses import dataclass
from collections import defaultdict
import math
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func

from ..models.filter_inventory_models import FilterInventory, FilterUsagePattern
from ..models.user_models import User
from ..services.filter_calculation import FilterCalculationService
from ..services.filter_inventory_service import FilterInventoryService
from ..services.logging_service import LoggingService
from ..services.user_management import UserManagementService


@dataclass
class FilterChangeSchedule:
    """Represents a scheduled filter change"""
    station_id: str
    station_name: str
    location: Dict[str, float]  # lat, lng
    last_change_date: Optional[date]
    next_change_due: date
    filters_needed: Dict[str, int]  # part_number: quantity
    priority: int  # 1-10, higher is more urgent
    estimated_time: int  # minutes
    notes: Optional[str] = None


@dataclass
class RouteOptimization:
    """Optimized route for filter changes"""
    route_id: str
    date: date
    stations: List[FilterChangeSchedule]
    total_time: int  # minutes
    total_distance: float  # miles
    total_filters: Dict[str, int]  # part_number: quantity
    efficiency_score: float  # 0-100


class FilterSchedulingService:
    """Service for optimizing filter change schedules"""
    
    # V1 Business Rules
    STANDARD_CHANGE_INTERVAL_DAYS = 90  # 3 months default
    MAX_CHANGE_INTERVAL_DAYS = 180  # 6 months maximum
    MIN_CHANGE_INTERVAL_DAYS = 30  # 1 month minimum for high-usage
    
    # Route optimization parameters
    MAX_STATIONS_PER_ROUTE = 8
    MAX_ROUTE_TIME_MINUTES = 480  # 8 hours
    MAX_ROUTE_DISTANCE_MILES = 150
    
    # Time estimates (minutes)
    BASE_CHANGE_TIME = 15  # Per station
    TIME_PER_FILTER = 3  # Additional per filter
    TRAVEL_TIME_PER_MILE = 2  # Average including traffic
    
    def __init__(self, db: Session):
        self.db = db
        self.logging_service = LoggingService(db)
        self.filter_calc_service = FilterCalculationService(db)
        self.inventory_service = FilterInventoryService(db)
        self.user_service = UserManagementService(db)
    
    async def generate_change_schedule(
        self,
        user_id: str,
        start_date: date,
        end_date: date,
        station_filter: Optional[List[str]] = None
    ) -> List[FilterChangeSchedule]:
        """
        Generate filter change schedule for date range
        
        Analyzes historical usage patterns and calculates optimal
        change dates for each station.
        """
        try:
            schedules = []
            
            # Get user's work week preferences
            work_week = self.user_service.get_user_preference(user_id, "work_week")
            if not work_week:
                work_week = {"start_day": 1, "end_day": 5}  # Mon-Fri default
            
            # Get station usage history
            station_usage = await self._get_station_usage_history(
                start_date - timedelta(days=180),  # Look back 6 months
                end_date,
                station_filter
            )
            
            # Calculate change schedules for each station
            for station_id, usage_data in station_usage.items():
                # Determine change interval based on usage
                change_interval = self._calculate_change_interval(usage_data)
                
                # Find last change date
                last_change = usage_data.get("last_filter_change")
                if not last_change:
                    # Estimate based on usage patterns
                    last_change = self._estimate_last_change(usage_data)
                
                # Calculate next change date
                next_change = last_change + timedelta(days=change_interval)
                
                # Skip if not within date range
                if next_change < start_date or next_change > end_date:
                    continue
                
                # Adjust to work week
                next_change = self._adjust_to_work_week(next_change, work_week)
                
                # Calculate filters needed
                filters_needed = await self._calculate_filters_for_station(
                    station_id, usage_data
                )
                
                # Calculate priority
                priority = self._calculate_priority(
                    last_change, next_change, usage_data
                )
                
                # Estimate time
                estimated_time = self._estimate_change_time(filters_needed)
                
                schedule = FilterChangeSchedule(
                    station_id=station_id,
                    station_name=usage_data["name"],
                    location=usage_data["location"],
                    last_change_date=last_change,
                    next_change_due=next_change,
                    filters_needed=filters_needed,
                    priority=priority,
                    estimated_time=estimated_time,
                    notes=usage_data.get("notes")
                )
                
                schedules.append(schedule)
            
            # Sort by priority and date
            schedules.sort(key=lambda s: (-s.priority, s.next_change_due))
            
            await self.logging_service.log_info(
                f"Generated {len(schedules)} filter change schedules for user {user_id}"
            )
            
            return schedules
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to generate change schedule: {str(e)}"
            )
            raise
    
    async def optimize_routes(
        self,
        schedules: List[FilterChangeSchedule],
        date: date,
        start_location: Optional[Dict[str, float]] = None
    ) -> List[RouteOptimization]:
        """
        Optimize routes for filter changes on a specific date
        
        Groups stations by geographic proximity and creates
        efficient routes considering time and distance constraints.
        """
        try:
            # Filter schedules for the specific date
            day_schedules = [s for s in schedules if s.next_change_due == date]
            
            if not day_schedules:
                return []
            
            # If no start location, use first station
            if not start_location:
                start_location = day_schedules[0].location
            
            # Group stations using clustering algorithm
            clusters = self._cluster_stations(day_schedules, start_location)
            
            routes = []
            for cluster_id, stations in clusters.items():
                # Optimize route within cluster
                optimized_stations = self._optimize_route_tsp(
                    stations, start_location
                )
                
                # Calculate route metrics
                total_time = sum(s.estimated_time for s in optimized_stations)
                total_distance = self._calculate_route_distance(
                    optimized_stations, start_location
                )
                
                # Add travel time
                total_time += int(total_distance * self.TRAVEL_TIME_PER_MILE)
                
                # Aggregate filters
                total_filters = defaultdict(int)
                for station in optimized_stations:
                    for part, qty in station.filters_needed.items():
                        total_filters[part] += qty
                
                # Calculate efficiency score
                efficiency = self._calculate_efficiency_score(
                    len(optimized_stations),
                    total_time,
                    total_distance
                )
                
                route = RouteOptimization(
                    route_id=str(uuid.uuid4()),
                    date=date,
                    stations=optimized_stations,
                    total_time=total_time,
                    total_distance=total_distance,
                    total_filters=dict(total_filters),
                    efficiency_score=efficiency
                )
                
                routes.append(route)
            
            # Sort routes by efficiency
            routes.sort(key=lambda r: -r.efficiency_score)
            
            await self.logging_service.log_info(
                f"Optimized {len(routes)} routes for {len(day_schedules)} stations"
            )
            
            return routes
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to optimize routes: {str(e)}"
            )
            raise
    
    async def suggest_bulk_changes(
        self,
        user_id: str,
        weeks_ahead: int = 4
    ) -> Dict[str, Any]:
        """
        Suggest bulk filter changes to minimize truck rolls
        
        Analyzes upcoming filter needs and suggests grouping
        changes even if some filters aren't quite due yet.
        """
        try:
            start_date = date.today()
            end_date = start_date + timedelta(weeks=weeks_ahead)
            
            # Get all scheduled changes
            schedules = await self.generate_change_schedule(
                user_id, start_date, end_date
            )
            
            # Group by week
            weekly_groups = defaultdict(list)
            for schedule in schedules:
                week_key = schedule.next_change_due.isocalendar()[1]
                weekly_groups[week_key].append(schedule)
            
            suggestions = []
            
            for week, week_schedules in weekly_groups.items():
                # Find stations that could be combined
                for i, schedule in enumerate(week_schedules):
                    nearby_stations = []
                    
                    # Look for nearby stations in next 2 weeks
                    for future_week in range(week + 1, week + 3):
                        if future_week in weekly_groups:
                            for future_schedule in weekly_groups[future_week]:
                                distance = self._calculate_distance(
                                    schedule.location,
                                    future_schedule.location
                                )
                                
                                if distance < 10:  # Within 10 miles
                                    days_early = (
                                        future_schedule.next_change_due - 
                                        schedule.next_change_due
                                    ).days
                                    
                                    nearby_stations.append({
                                        "station": future_schedule,
                                        "distance": distance,
                                        "days_early": days_early,
                                        "savings": self._calculate_savings(
                                            distance, days_early
                                        )
                                    })
                    
                    if nearby_stations:
                        suggestions.append({
                            "primary_station": schedule,
                            "combine_with": sorted(
                                nearby_stations,
                                key=lambda x: -x["savings"]
                            )[:3],  # Top 3 suggestions
                            "total_savings": sum(
                                s["savings"] for s in nearby_stations[:3]
                            )
                        })
            
            # Sort by potential savings
            suggestions.sort(key=lambda s: -s["total_savings"])
            
            return {
                "suggestions": suggestions[:10],  # Top 10 suggestions
                "potential_truck_rolls_saved": len(suggestions),
                "estimated_cost_savings": sum(
                    s["total_savings"] for s in suggestions[:10]
                )
            }
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to suggest bulk changes: {str(e)}"
            )
            raise
    
    async def get_change_history(
        self,
        station_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Get filter change history for a station"""
        try:
            # Query transaction history for filter changes at this station
            from ..models.filter_inventory_models import FilterInventoryTransaction
            
            transactions = self.db.query(FilterInventoryTransaction).filter(
                and_(
                    FilterInventoryTransaction.station_name == station_id,
                    FilterInventoryTransaction.transaction_type == "USAGE"
                )
            ).order_by(
                FilterInventoryTransaction.created_at.desc()
            ).limit(limit).all()
            
            history = []
            for trans in transactions:
                history.append({
                    "date": trans.created_at.date(),
                    "filters_changed": abs(trans.quantity),
                    "part_number": trans.part_number,
                    "work_order_id": trans.work_order_id
                })
            
            return history
            
        except Exception as e:
            await self.logging_service.log_error(
                f"Failed to get change history: {str(e)}"
            )
            raise
    
    def _calculate_change_interval(self, usage_data: Dict[str, Any]) -> int:
        """Calculate optimal change interval based on usage patterns"""
        avg_monthly_usage = usage_data.get("avg_monthly_filters", 0)
        
        if avg_monthly_usage == 0:
            return self.STANDARD_CHANGE_INTERVAL_DAYS
        
        # High usage = shorter interval
        if avg_monthly_usage > 50:
            return self.MIN_CHANGE_INTERVAL_DAYS
        elif avg_monthly_usage > 20:
            return 60  # 2 months
        elif avg_monthly_usage > 10:
            return self.STANDARD_CHANGE_INTERVAL_DAYS
        else:
            return 120  # 4 months for low usage
    
    def _calculate_priority(
        self,
        last_change: date,
        next_change: date,
        usage_data: Dict[str, Any]
    ) -> int:
        """Calculate priority score (1-10)"""
        days_overdue = (date.today() - next_change).days
        
        if days_overdue > 30:
            base_priority = 10
        elif days_overdue > 14:
            base_priority = 8
        elif days_overdue > 0:
            base_priority = 6
        else:
            days_until_due = (next_change - date.today()).days
            if days_until_due < 7:
                base_priority = 5
            elif days_until_due < 14:
                base_priority = 3
            else:
                base_priority = 1
        
        # Adjust for high-value stations
        if usage_data.get("is_high_value", False):
            base_priority = min(10, base_priority + 2)
        
        return base_priority
    
    def _estimate_change_time(self, filters_needed: Dict[str, int]) -> int:
        """Estimate time needed for filter changes"""
        total_filters = sum(filters_needed.values())
        return self.BASE_CHANGE_TIME + (total_filters * self.TIME_PER_FILTER)
    
    def _calculate_distance(self, loc1: Dict[str, float], loc2: Dict[str, float]) -> float:
        """Calculate distance between two locations (haversine formula)"""
        if not loc1 or not loc2:
            return 0
        
        # Convert to radians
        lat1, lon1 = math.radians(loc1["lat"]), math.radians(loc1["lng"])
        lat2, lon2 = math.radians(loc2["lat"]), math.radians(loc2["lng"])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Earth's radius in miles
        r = 3959
        
        return r * c
    
    def _cluster_stations(
        self,
        stations: List[FilterChangeSchedule],
        start_location: Dict[str, float]
    ) -> Dict[int, List[FilterChangeSchedule]]:
        """Cluster stations using simple distance-based algorithm"""
        clusters = defaultdict(list)
        unassigned = stations.copy()
        cluster_id = 0
        
        while unassigned:
            # Start new cluster
            cluster = [unassigned.pop(0)]
            cluster_time = cluster[0].estimated_time
            
            # Add nearby stations
            i = 0
            while i < len(unassigned):
                station = unassigned[i]
                
                # Check if station can be added to cluster
                min_distance = float('inf')
                for cluster_station in cluster:
                    distance = self._calculate_distance(
                        station.location,
                        cluster_station.location
                    )
                    min_distance = min(min_distance, distance)
                
                # Check constraints
                new_time = cluster_time + station.estimated_time + (min_distance * self.TRAVEL_TIME_PER_MILE)
                
                if (len(cluster) < self.MAX_STATIONS_PER_ROUTE and
                    new_time <= self.MAX_ROUTE_TIME_MINUTES and
                    min_distance <= 20):  # Within 20 miles of cluster
                    
                    cluster.append(unassigned.pop(i))
                    cluster_time = new_time
                else:
                    i += 1
            
            clusters[cluster_id] = cluster
            cluster_id += 1
        
        return clusters
    
    def _optimize_route_tsp(
        self,
        stations: List[FilterChangeSchedule],
        start_location: Dict[str, float]
    ) -> List[FilterChangeSchedule]:
        """
        Optimize route using nearest neighbor TSP approximation
        
        Simple but effective for small station counts.
        """
        if len(stations) <= 1:
            return stations
        
        optimized = []
        remaining = stations.copy()
        current_location = start_location
        
        while remaining:
            # Find nearest station
            nearest = min(
                remaining,
                key=lambda s: self._calculate_distance(current_location, s.location)
            )
            
            optimized.append(nearest)
            remaining.remove(nearest)
            current_location = nearest.location
        
        return optimized
    
    def _calculate_route_distance(
        self,
        stations: List[FilterChangeSchedule],
        start_location: Dict[str, float]
    ) -> float:
        """Calculate total route distance"""
        if not stations:
            return 0
        
        total_distance = 0
        current_location = start_location
        
        for station in stations:
            total_distance += self._calculate_distance(
                current_location,
                station.location
            )
            current_location = station.location
        
        # Return to start
        total_distance += self._calculate_distance(
            current_location,
            start_location
        )
        
        return total_distance
    
    def _calculate_efficiency_score(
        self,
        station_count: int,
        total_time: int,
        total_distance: float
    ) -> float:
        """Calculate route efficiency score (0-100)"""
        # Ideal metrics
        ideal_stations_per_hour = 1.5
        ideal_miles_per_station = 10
        
        # Calculate actual metrics
        hours = total_time / 60
        stations_per_hour = station_count / hours if hours > 0 else 0
        miles_per_station = total_distance / station_count if station_count > 0 else 0
        
        # Calculate scores
        time_score = min(100, (stations_per_hour / ideal_stations_per_hour) * 100)
        distance_score = min(100, (ideal_miles_per_station / miles_per_station) * 100)
        
        # Weight time more heavily
        return (time_score * 0.6) + (distance_score * 0.4)
    
    def _adjust_to_work_week(
        self,
        target_date: date,
        work_week: Dict[str, int]
    ) -> date:
        """Adjust date to fall within work week"""
        weekday = target_date.weekday()
        
        # If already in work week, return as is
        if work_week["start_day"] <= weekday <= work_week["end_day"]:
            return target_date
        
        # Move to next work week start
        days_to_add = (work_week["start_day"] - weekday) % 7
        if days_to_add == 0:
            days_to_add = 7
        
        return target_date + timedelta(days=days_to_add)
    
    def _calculate_savings(self, distance: float, days_early: int) -> float:
        """Calculate cost savings from combining trips"""
        # Estimated costs
        cost_per_mile = 2.50
        cost_per_trip = 50  # Fixed costs
        
        # Savings from eliminated trip
        trip_savings = cost_per_trip + (distance * 2 * cost_per_mile)
        
        # Penalty for changing filters early
        early_penalty = days_early * 0.50  # $0.50 per day early per filter
        
        return max(0, trip_savings - early_penalty)
    
    async def _get_station_usage_history(
        self,
        start_date: date,
        end_date: date,
        station_filter: Optional[List[str]] = None
    ) -> Dict[str, Dict[str, Any]]:
        """Get usage history for stations"""
        # This would integrate with work order service
        # For now, return mock data structure
        return {}
    
    async def _calculate_filters_for_station(
        self,
        station_id: str,
        usage_data: Dict[str, Any]
    ) -> Dict[str, int]:
        """Calculate filters needed for a station"""
        # This would use historical data to estimate
        # For now, return typical values
        station_type = usage_data.get("type", "standard")
        
        if station_type == "high_volume":
            return {"400MB-10": 12, "400HS-10": 6}
        else:
            return {"400MB-10": 6, "400HS-10": 3}
    
    def _estimate_last_change(self, usage_data: Dict[str, Any]) -> date:
        """Estimate last change date based on usage patterns"""
        # Default to 3 months ago if no data
        return date.today() - timedelta(days=90)