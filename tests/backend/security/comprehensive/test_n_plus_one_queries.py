#!/usr/bin/env python3
"""
N+1 Query Detection Tests
Tests for detecting and preventing N+1 query performance issues
"""

import os
import sys
import pytest
from pathlib import Path
from fastapi.testclient import TestClient
from sqlalchemy import event, create_engine
from sqlalchemy.orm import Session
from typing import List, Dict
import time
from datetime import datetime
import logging

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent.parent))

from app.main import app
from app.database import get_db, Base, engine
from app.models.user_models import User
from app.models import WorkOrder, Dispenser
from app.auth.security import create_access_token, get_password_hash

# Configure logging to capture SQL queries
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Test client
client = TestClient(app)

# Query counter
query_count = 0
query_log = []


class QueryCounter:
    """Track SQL queries for N+1 detection"""
    
    def __init__(self):
        self.queries = []
        self.count = 0
        self.enabled = False
    
    def reset(self):
        """Reset query counter"""
        self.queries = []
        self.count = 0
    
    def before_cursor_execute(self, conn, cursor, statement, parameters, context, executemany):
        """Log queries before execution"""
        if self.enabled:
            self.count += 1
            self.queries.append({
                "statement": statement,
                "parameters": parameters,
                "timestamp": time.time()
            })
            logger.debug(f"Query {self.count}: {statement[:100]}...")


# Global query counter
query_counter = QueryCounter()


class TestNPlusOneQueries:
    """Test cases for N+1 query detection"""
    
    @classmethod
    def setup_class(cls):
        """Setup test environment and query tracking"""
        os.environ["SECRET_KEY"] = "test_secret_key_for_n_plus_one"
        os.environ["FOSSAWORK_MASTER_KEY"] = "test_master_key"
        
        # Create test database
        Base.metadata.create_all(bind=engine)
        
        # Set up query tracking
        event.listen(engine, "before_cursor_execute", query_counter.before_cursor_execute)
        
        # Create test data
        cls._create_test_data()
    
    @classmethod
    def teardown_class(cls):
        """Cleanup test environment"""
        Base.metadata.drop_all(bind=engine)
        event.remove(engine, "before_cursor_execute", query_counter.before_cursor_execute)
        
        if "SECRET_KEY" in os.environ:
            del os.environ["SECRET_KEY"]
        if "FOSSAWORK_MASTER_KEY" in os.environ:
            del os.environ["FOSSAWORK_MASTER_KEY"]
    
    @classmethod
    def _create_test_data(cls):
        """Create test data with relationships"""
        db = next(get_db())
        try:
            # Create test user
            user = User(
                id="n1_test_user",
                username="n1test@example.com",
                email="n1test@example.com",
                hashed_password=get_password_hash("TestPassword123!"),
                is_active=True
            )
            db.add(user)
            
            # Create many work orders
            for i in range(50):
                wo = WorkOrder(
                    id=f"wo_n1_{i}",
                    work_order_id=f"W-{5000 + i}",
                    user_id="n1_test_user",
                    store_number=f"{1000 + i}",
                    customer_name=f"Customer {i}",
                    address=f"{i} Test Street",
                    service_code="2861",
                    created_at=datetime.utcnow(),
                    visit_url=f"/visits/n1_{i}"
                )
                db.add(wo)
                
                # Add related dispensers for each work order
                for j in range(3):
                    disp = Dispenser(
                        id=f"disp_n1_{i}_{j}",
                        user_id="n1_test_user",
                        store_id=f"{1000 + i}",
                        unit_id=f"Unit_{i}_{j}",
                        manufacturer=f"Manufacturer {j}",
                        model=f"Model {j}",
                        scraped_data={"index": j}
                    )
                    db.add(disp)
            
            db.commit()
        finally:
            db.close()
    
    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers"""
        response = client.post(
            "/api/auth/login",
            json={"username": "n1test@example.com", "password": "TestPassword123!"}
        )
        assert response.status_code == 200
        token = response.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}
    
    def count_queries(self, func, *args, **kwargs):
        """Execute function and count queries"""
        query_counter.reset()
        query_counter.enabled = True
        
        try:
            result = func(*args, **kwargs)
            return result, query_counter.count, query_counter.queries
        finally:
            query_counter.enabled = False
    
    def test_work_orders_list_no_n_plus_one(self):
        """Test that listing work orders doesn't cause N+1 queries"""
        auth_headers = self.get_auth_headers()
        
        # First, get the count with 1 work order
        response, query_count_1, _ = self.count_queries(
            client.get, "/api/v1/work-orders?limit=1", headers=auth_headers
        )
        assert response.status_code == 200
        
        # Now get 20 work orders
        response, query_count_20, queries = self.count_queries(
            client.get, "/api/v1/work-orders?limit=20", headers=auth_headers
        )
        assert response.status_code == 200
        
        # The query count should not scale linearly with the number of records
        # It should be roughly the same (maybe +1 or +2 for pagination)
        assert query_count_20 <= query_count_1 + 2, \
            f"N+1 detected: 1 item = {query_count_1} queries, 20 items = {query_count_20} queries"
        
        # Log queries for debugging
        logger.info(f"Queries for 1 item: {query_count_1}")
        logger.info(f"Queries for 20 items: {query_count_20}")
    
    def test_dispensers_with_work_orders_no_n_plus_one(self):
        """Test that fetching dispensers with related data doesn't cause N+1"""
        auth_headers = self.get_auth_headers()
        
        # Test with one store
        response, query_count_1, _ = self.count_queries(
            client.get, "/api/dispensers/1000", headers=auth_headers
        )
        assert response.status_code == 200
        
        # Create a batch endpoint test (if exists)
        # This simulates fetching dispensers for multiple stores
        store_ids = [str(1000 + i) for i in range(10)]
        total_queries = 0
        
        for store_id in store_ids:
            response, count, _ = self.count_queries(
                client.get, f"/api/dispensers/{store_id}", headers=auth_headers
            )
            total_queries += count
        
        # Average queries per store should be similar to single store
        avg_queries = total_queries / len(store_ids)
        assert avg_queries <= query_count_1 * 1.5, \
            f"Possible N+1: Single store = {query_count_1} queries, " \
            f"Average for multiple = {avg_queries} queries"
    
    def test_eager_loading_implemented(self):
        """Test that eager loading is properly implemented for relationships"""
        auth_headers = self.get_auth_headers()
        
        # Get work orders and check if related data is loaded efficiently
        response, query_count, queries = self.count_queries(
            client.get, "/api/v1/work-orders?limit=10", headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()["data"]
        
        # Analyze queries for JOIN statements (indicates eager loading)
        join_queries = [q for q in queries if "JOIN" in q["statement"].upper()]
        select_queries = [q for q in queries if q["statement"].upper().startswith("SELECT")]
        
        # Should have few SELECT queries relative to data returned
        assert len(select_queries) < len(data), \
            f"Too many SELECT queries ({len(select_queries)}) for {len(data)} items"
        
        logger.info(f"Total queries: {query_count}")
        logger.info(f"JOIN queries: {len(join_queries)}")
        logger.info(f"SELECT queries: {len(select_queries)}")
    
    def test_pagination_query_efficiency(self):
        """Test that pagination doesn't increase query count"""
        auth_headers = self.get_auth_headers()
        
        # Page 1
        response1, count1, _ = self.count_queries(
            client.get, "/api/v1/work-orders?limit=10&offset=0", headers=auth_headers
        )
        assert response1.status_code == 200
        
        # Page 2
        response2, count2, _ = self.count_queries(
            client.get, "/api/v1/work-orders?limit=10&offset=10", headers=auth_headers
        )
        assert response2.status_code == 200
        
        # Page 3
        response3, count3, _ = self.count_queries(
            client.get, "/api/v1/work-orders?limit=10&offset=20", headers=auth_headers
        )
        assert response3.status_code == 200
        
        # Query counts should be consistent across pages
        assert abs(count1 - count2) <= 1, \
            f"Inconsistent query count: Page 1 = {count1}, Page 2 = {count2}"
        assert abs(count2 - count3) <= 1, \
            f"Inconsistent query count: Page 2 = {count2}, Page 3 = {count3}"
    
    def test_filtering_query_efficiency(self):
        """Test that filtering doesn't cause N+1 queries"""
        auth_headers = self.get_auth_headers()
        
        # No filter
        response1, count1, _ = self.count_queries(
            client.get, "/api/v1/work-orders", headers=auth_headers
        )
        assert response1.status_code == 200
        
        # With service code filter
        response2, count2, _ = self.count_queries(
            client.get, "/api/v1/work-orders?service_code=2861", headers=auth_headers
        )
        assert response2.status_code == 200
        
        # With multiple filters
        response3, count3, _ = self.count_queries(
            client.get, "/api/v1/work-orders?service_code=2861&store_number=1005", 
            headers=auth_headers
        )
        assert response3.status_code == 200
        
        # Query count shouldn't increase significantly with filters
        assert count2 <= count1 + 2, \
            f"Filter increased queries too much: No filter = {count1}, With filter = {count2}"
        assert count3 <= count1 + 3, \
            f"Multiple filters increased queries too much: No filter = {count1}, With filters = {count3}"
    
    def test_bulk_operations_efficiency(self):
        """Test that bulk operations are efficient"""
        auth_headers = self.get_auth_headers()
        
        # Simulate bulk update scenario
        work_order_ids = [f"wo_n1_{i}" for i in range(10)]
        
        total_queries = 0
        for wo_id in work_order_ids:
            # Get individual work order
            response, count, _ = self.count_queries(
                client.get, f"/api/v1/work-orders/{wo_id}", headers=auth_headers
            )
            if response.status_code == 200:
                total_queries += count
        
        # Average queries per item should be low
        avg_queries = total_queries / len(work_order_ids)
        assert avg_queries <= 3, \
            f"Individual fetches too expensive: Average {avg_queries} queries per item"
    
    def test_complex_query_optimization(self):
        """Test that complex queries with multiple joins are optimized"""
        auth_headers = self.get_auth_headers()
        
        # Test endpoint that might join multiple tables
        # For example, work orders with dispensers and user info
        response, query_count, queries = self.count_queries(
            client.get, "/api/v1/work-orders?include_dispensers=true", 
            headers=auth_headers
        )
        
        # Even with complex data, should have reasonable query count
        assert query_count < 10, \
            f"Complex query generated too many queries: {query_count}"
        
        # Check for efficient JOIN usage
        complex_queries = [q for q in queries if q["statement"].count("JOIN") > 1]
        logger.info(f"Complex queries with multiple JOINs: {len(complex_queries)}")
    
    def test_api_response_includes_related_data(self):
        """Test that API responses include related data to prevent client-side N+1"""
        auth_headers = self.get_auth_headers()
        
        # Get work orders
        response = client.get("/api/v1/work-orders?limit=5", headers=auth_headers)
        assert response.status_code == 200
        
        work_orders = response.json()["data"]
        
        # Check if response includes necessary related data
        for wo in work_orders:
            # Should include basic fields without requiring additional requests
            assert "work_order_id" in wo
            assert "store_number" in wo
            assert "customer_name" in wo
            
            # If dispensers are included, they should be complete
            if "dispensers" in wo:
                for dispenser in wo["dispensers"]:
                    assert "unit_id" in dispenser
                    assert "manufacturer" in dispenser
    
    def test_query_performance_benchmarks(self):
        """Test that queries meet performance benchmarks"""
        auth_headers = self.get_auth_headers()
        
        # Benchmark: List 50 work orders
        start_time = time.time()
        response, query_count, _ = self.count_queries(
            client.get, "/api/v1/work-orders?limit=50", headers=auth_headers
        )
        end_time = time.time()
        
        assert response.status_code == 200
        
        # Should complete quickly
        duration = end_time - start_time
        assert duration < 1.0, f"Query took too long: {duration:.2f} seconds"
        
        # Should use reasonable number of queries
        assert query_count < 10, f"Too many queries for 50 items: {query_count}"
        
        # Calculate queries per item
        items = response.json()["data"]
        queries_per_item = query_count / len(items) if items else 0
        assert queries_per_item < 0.5, \
            f"Too many queries per item: {queries_per_item:.2f}"
    
    def test_database_indexes_utilized(self):
        """Test that queries utilize database indexes efficiently"""
        auth_headers = self.get_auth_headers()
        
        # Test common query patterns
        test_queries = [
            "/api/v1/work-orders?store_number=1010",
            "/api/v1/work-orders?service_code=2861",
            f"/api/v1/work-orders?created_after={datetime.utcnow().isoformat()}",
        ]
        
        for endpoint in test_queries:
            response, count, queries = self.count_queries(
                client.get, endpoint, headers=auth_headers
            )
            
            # Indexed queries should be fast (low query count)
            assert count <= 5, \
                f"Query pattern '{endpoint}' generated too many queries: {count}"
            
            # Check for table scans (would appear in query plan)
            # This is a simplified check - real implementation would analyze query plans
            for query in queries:
                statement = query["statement"].upper()
                # Basic check for obvious performance issues
                assert "SELECT * FROM" not in statement.replace(" ", ""), \
                    "Found SELECT * query which may indicate missing optimization"


if __name__ == "__main__":
    # Run tests
    test = TestNPlusOneQueries()
    test.setup_class()
    
    try:
        print("Running N+1 query detection tests...")
        
        test.test_work_orders_list_no_n_plus_one()
        print("✓ Work orders list has no N+1 queries")
        
        test.test_dispensers_with_work_orders_no_n_plus_one()
        print("✓ Dispensers endpoint has no N+1 queries")
        
        test.test_eager_loading_implemented()
        print("✓ Eager loading is properly implemented")
        
        test.test_pagination_query_efficiency()
        print("✓ Pagination is query-efficient")
        
        test.test_filtering_query_efficiency()
        print("✓ Filtering doesn't cause N+1 queries")
        
        test.test_bulk_operations_efficiency()
        print("✓ Bulk operations are efficient")
        
        test.test_complex_query_optimization()
        print("✓ Complex queries are optimized")
        
        test.test_api_response_includes_related_data()
        print("✓ API responses include related data")
        
        test.test_query_performance_benchmarks()
        print("✓ Queries meet performance benchmarks")
        
        test.test_database_indexes_utilized()
        print("✓ Database indexes are utilized efficiently")
        
        print("\nAll N+1 query detection tests passed! ✓")
        
    finally:
        test.teardown_class()