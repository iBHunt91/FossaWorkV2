#!/usr/bin/env python3
"""
Test query performance before and after optimizations
"""
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import time
import asyncio
from typing import Dict, Any
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from app.database import SQLALCHEMY_DATABASE_URL
from app.core_models import WorkOrder, Dispenser, User
from app.utils.query_profiler import QueryProfiler
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PerformanceTester:
    """Test query performance for N+1 detection and optimization verification"""
    
    def __init__(self):
        self.engine = create_engine(SQLALCHEMY_DATABASE_URL)
        self.SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=self.engine)
        
    def test_n_plus_one_queries(self) -> Dict[str, Any]:
        """Test the original N+1 query pattern"""
        logger.info("\n=== Testing N+1 Query Pattern (Original) ===")
        
        db = self.SessionLocal()
        profiler = QueryProfiler()
        
        try:
            with profiler:
                # Simulate the original N+1 pattern
                start_time = time.time()
                
                # Get all work orders (without eager loading)
                work_orders = db.query(WorkOrder).limit(50).all()
                
                # For each work order, fetch dispensers separately (N+1 problem)
                total_dispensers = 0
                for wo in work_orders:
                    dispensers = db.query(Dispenser).filter(
                        Dispenser.work_order_id == wo.id
                    ).all()
                    total_dispensers += len(dispensers)
                
                duration = time.time() - start_time
                
            analysis = profiler.analyze()
            
            logger.info(f"Fetched {len(work_orders)} work orders with {total_dispensers} dispensers")
            logger.info(f"Total time: {duration:.3f}s")
            logger.info(f"Total queries: {analysis['total_queries']}")
            
            return {
                "pattern": "N+1 (Original)",
                "work_orders": len(work_orders),
                "dispensers": total_dispensers,
                "duration": duration,
                "total_queries": analysis['total_queries'],
                "analysis": analysis
            }
            
        finally:
            db.close()
            
    def test_eager_loading(self) -> Dict[str, Any]:
        """Test the optimized eager loading pattern"""
        logger.info("\n=== Testing Eager Loading Pattern (Optimized) ===")
        
        from sqlalchemy.orm import joinedload
        
        db = self.SessionLocal()
        profiler = QueryProfiler()
        
        try:
            with profiler:
                # Simulate the optimized pattern with eager loading
                start_time = time.time()
                
                # Get all work orders with eager loading
                work_orders = db.query(WorkOrder)\
                    .options(joinedload(WorkOrder.dispensers))\
                    .limit(50)\
                    .all()
                
                # Access dispensers (already loaded, no additional queries)
                total_dispensers = 0
                for wo in work_orders:
                    total_dispensers += len(wo.dispensers)
                
                duration = time.time() - start_time
                
            analysis = profiler.analyze()
            
            logger.info(f"Fetched {len(work_orders)} work orders with {total_dispensers} dispensers")
            logger.info(f"Total time: {duration:.3f}s")
            logger.info(f"Total queries: {analysis['total_queries']}")
            
            return {
                "pattern": "Eager Loading (Optimized)",
                "work_orders": len(work_orders),
                "dispensers": total_dispensers,
                "duration": duration,
                "total_queries": analysis['total_queries'],
                "analysis": analysis
            }
            
        finally:
            db.close()
            
    def test_pagination_performance(self) -> Dict[str, Any]:
        """Test pagination performance"""
        logger.info("\n=== Testing Pagination Performance ===")
        
        from sqlalchemy.orm import joinedload
        
        db = self.SessionLocal()
        results = []
        
        try:
            # Test different page sizes
            page_sizes = [10, 50, 100, 200]
            
            for page_size in page_sizes:
                profiler = QueryProfiler()
                
                with profiler:
                    start_time = time.time()
                    
                    # Paginated query with eager loading
                    work_orders = db.query(WorkOrder)\
                        .options(joinedload(WorkOrder.dispensers))\
                        .order_by(WorkOrder.scheduled_date.desc())\
                        .offset(0)\
                        .limit(page_size)\
                        .all()
                    
                    # Access dispensers
                    total_dispensers = sum(len(wo.dispensers) for wo in work_orders)
                    
                    duration = time.time() - start_time
                    
                analysis = profiler.analyze()
                
                results.append({
                    "page_size": page_size,
                    "duration": duration,
                    "queries": analysis['total_queries'],
                    "work_orders": len(work_orders),
                    "dispensers": total_dispensers
                })
                
                logger.info(f"Page size {page_size}: {duration:.3f}s, {analysis['total_queries']} queries")
                
            return {
                "pattern": "Pagination Test",
                "results": results
            }
            
        finally:
            db.close()
            
    def create_test_data(self, num_work_orders: int = 100, dispensers_per_wo: int = 6):
        """Create test data for performance testing"""
        logger.info(f"\nCreating test data: {num_work_orders} work orders, {dispensers_per_wo} dispensers each...")
        
        db = self.SessionLocal()
        
        try:
            # Check if we already have enough test data
            existing_count = db.query(WorkOrder).count()
            if existing_count >= num_work_orders:
                logger.info(f"Already have {existing_count} work orders, skipping data creation")
                return
                
            # Get or create a test user
            test_user = db.query(User).filter(User.username == "performance_test").first()
            if not test_user:
                test_user = User(
                    username="performance_test",
                    email="test@example.com",
                    is_active=True
                )
                db.add(test_user)
                db.commit()
                
            # Create work orders and dispensers
            for i in range(num_work_orders - existing_count):
                wo = WorkOrder(
                    user_id=test_user.id,
                    external_id=f"W-{100000 + i}",
                    site_name=f"Test Store {i}",
                    address=f"{i} Test Street, Test City, TS 12345",
                    store_number=f"#{1000 + i}",
                    service_code="2861",
                    service_description="AccuMeasure - All Dispensers",
                    status="pending"
                )
                db.add(wo)
                db.flush()  # Get the ID
                
                # Create dispensers for this work order
                for j in range(dispensers_per_wo):
                    dispenser = Dispenser(
                        work_order_id=wo.id,
                        dispenser_number=f"{j+1}/{j+2}",
                        dispenser_type="Wayne Vista",
                        make="Wayne",
                        model="Vista",
                        status="pending"
                    )
                    db.add(dispenser)
                    
            db.commit()
            logger.info("Test data created successfully")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to create test data: {str(e)}")
            raise
        finally:
            db.close()
            
    def run_comparison(self):
        """Run a full comparison of query patterns"""
        logger.info("=" * 60)
        logger.info("Query Performance Comparison")
        logger.info("=" * 60)
        
        # Test N+1 pattern
        n_plus_one_results = self.test_n_plus_one_queries()
        
        # Test eager loading
        eager_loading_results = self.test_eager_loading()
        
        # Test pagination
        pagination_results = self.test_pagination_performance()
        
        # Calculate improvements
        improvement_factor = n_plus_one_results['duration'] / eager_loading_results['duration']
        query_reduction = n_plus_one_results['total_queries'] - eager_loading_results['total_queries']
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("PERFORMANCE SUMMARY")
        logger.info("=" * 60)
        
        logger.info(f"\nN+1 Pattern (Original):")
        logger.info(f"  - Duration: {n_plus_one_results['duration']:.3f}s")
        logger.info(f"  - Queries: {n_plus_one_results['total_queries']}")
        logger.info(f"  - Queries/second: {n_plus_one_results['analysis']['queries_per_second']:.1f}")
        
        logger.info(f"\nEager Loading (Optimized):")
        logger.info(f"  - Duration: {eager_loading_results['duration']:.3f}s")
        logger.info(f"  - Queries: {eager_loading_results['total_queries']}")
        logger.info(f"  - Queries/second: {eager_loading_results['analysis']['queries_per_second']:.1f}")
        
        logger.info(f"\nIMPROVEMENTS:")
        logger.info(f"  - Speed improvement: {improvement_factor:.1f}x faster")
        logger.info(f"  - Query reduction: {query_reduction} fewer queries")
        logger.info(f"  - Query reduction %: {(query_reduction/n_plus_one_results['total_queries']*100):.1f}%")
        
        logger.info(f"\nPagination Performance:")
        for result in pagination_results['results']:
            logger.info(f"  - Page size {result['page_size']}: {result['duration']:.3f}s")
            
        # Detect remaining N+1 issues
        if eager_loading_results['analysis']['n_plus_one_candidates']:
            logger.warning("\n⚠️  Potential remaining N+1 queries detected:")
            for candidate in eager_loading_results['analysis']['n_plus_one_candidates'][:3]:
                logger.warning(f"  - Pattern executed {candidate['count']} times")
                
        return {
            "n_plus_one": n_plus_one_results,
            "eager_loading": eager_loading_results,
            "pagination": pagination_results,
            "improvements": {
                "speed_factor": improvement_factor,
                "query_reduction": query_reduction,
                "query_reduction_percent": query_reduction/n_plus_one_results['total_queries']*100
            }
        }


async def test_api_endpoint_performance():
    """Test the actual API endpoint performance"""
    import httpx
    from app.utils.query_profiler import profile_endpoint
    
    logger.info("\n=== Testing API Endpoint Performance ===")
    
    # You would need to have the server running and provide auth token
    # This is a template for testing the actual endpoint
    
    async with httpx.AsyncClient() as client:
        # Example test (requires running server and auth)
        logger.info("To test actual API endpoints:")
        logger.info("1. Start the backend server")
        logger.info("2. Get an auth token")
        logger.info("3. Run queries against /api/work-orders/?user_id=XXX")
        logger.info("4. Check response headers for pagination info")


def main():
    """Main test runner"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Test query performance")
    parser.add_argument(
        "--create-data",
        action="store_true",
        help="Create test data before running tests"
    )
    parser.add_argument(
        "--num-work-orders",
        type=int,
        default=100,
        help="Number of work orders to create for testing"
    )
    parser.add_argument(
        "--dispensers-per-wo",
        type=int,
        default=6,
        help="Number of dispensers per work order"
    )
    
    args = parser.parse_args()
    
    tester = PerformanceTester()
    
    if args.create_data:
        tester.create_test_data(args.num_work_orders, args.dispensers_per_wo)
        
    # Run the comparison
    results = tester.run_comparison()
    
    # Save results to file
    import json
    with open("query_performance_results.json", "w") as f:
        json.dump(results, f, indent=2, default=str)
        logger.info(f"\nResults saved to query_performance_results.json")


if __name__ == "__main__":
    main()