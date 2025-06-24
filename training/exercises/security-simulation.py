#!/usr/bin/env python3
"""
Security Simulation Exercises for FossaWork V2
Interactive security training scenarios with hands-on practice
"""

import asyncio
import json
import random
import time
import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Any
import requests
import sqlite3
from pathlib import Path

class SecuritySimulation:
    """Interactive security simulation for training purposes"""
    
    def __init__(self):
        self.scenarios = self.load_scenarios()
        self.current_scenario = None
        self.user_responses = []
        self.score = 0
        self.start_time = None
        
        # Simulation database for tracking
        self.setup_simulation_db()
    
    def setup_simulation_db(self):
        """Set up simulation tracking database"""
        self.sim_db_path = "simulation_results.db"
        conn = sqlite3.connect(self.sim_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS simulation_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_name TEXT,
                scenario_name TEXT,
                start_time TEXT,
                end_time TEXT,
                score INTEGER,
                responses TEXT,
                completed BOOLEAN DEFAULT FALSE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS security_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id INTEGER,
                event_type TEXT,
                timestamp TEXT,
                details TEXT,
                user_action TEXT,
                correct_action TEXT,
                points_awarded INTEGER,
                FOREIGN KEY (session_id) REFERENCES simulation_sessions (id)
            )
        """)
        
        conn.commit()
        conn.close()
    
    def load_scenarios(self) -> Dict[str, Any]:
        """Load security training scenarios"""
        return {
            "credential_compromise": {
                "title": "Credential Compromise Detection and Response",
                "description": "Multiple failed login attempts detected from unusual locations",
                "difficulty": "Medium",
                "estimated_time": "15 minutes",
                "learning_objectives": [
                    "Detect suspicious authentication patterns",
                    "Implement account lockout procedures",
                    "Execute credential rotation",
                    "Communicate with affected users"
                ],
                "initial_state": {
                    "failed_logins": [
                        {"user": "admin", "ip": "192.168.1.100", "time": "10:00:00", "success": False},
                        {"user": "admin", "ip": "192.168.1.100", "time": "10:00:05", "success": False},
                        {"user": "admin", "ip": "203.0.113.50", "time": "10:05:00", "success": False},
                        {"user": "admin", "ip": "203.0.113.50", "time": "10:05:10", "success": False},
                        {"user": "admin", "ip": "203.0.113.50", "time": "10:05:15", "success": True},
                        {"user": "testuser", "ip": "203.0.113.50", "time": "10:10:00", "success": False},
                        {"user": "testuser", "ip": "203.0.113.50", "time": "10:10:05", "success": False}
                    ],
                    "normal_user_ips": ["192.168.1.100", "192.168.1.101", "192.168.1.102"],
                    "suspicious_ips": ["203.0.113.50"],
                    "compromised_accounts": ["admin"],
                    "active_sessions": [
                        {"user": "admin", "ip": "203.0.113.50", "session_id": "sess_malicious_123"},
                        {"user": "testuser", "ip": "192.168.1.101", "session_id": "sess_normal_456"}
                    ]
                }
            },
            
            "sql_injection_attack": {
                "title": "SQL Injection Attack Detection and Mitigation",
                "description": "Unusual database queries detected with potential SQL injection patterns",
                "difficulty": "High", 
                "estimated_time": "20 minutes",
                "learning_objectives": [
                    "Identify SQL injection attack patterns",
                    "Analyze database logs for malicious queries",
                    "Implement input validation fixes",
                    "Assess data breach impact"
                ],
                "initial_state": {
                    "suspicious_queries": [
                        "SELECT * FROM work_orders WHERE store_number = '1234' OR '1'='1'--'",
                        "SELECT * FROM users WHERE username = 'admin'; DROP TABLE users;--'",
                        "SELECT username, password FROM users WHERE id = 1 UNION SELECT table_name, column_name FROM information_schema.columns--",
                    ],
                    "normal_queries": [
                        "SELECT * FROM work_orders WHERE user_id = 123",
                        "INSERT INTO work_orders (store_number, customer_name) VALUES ('1234', 'Test Store')",
                        "UPDATE work_orders SET status = 'completed' WHERE id = 456"
                    ],
                    "affected_endpoints": [
                        "/api/work-orders/search",
                        "/api/auth/login", 
                        "/api/dispensers/search"
                    ],
                    "source_ips": ["198.51.100.25", "198.51.100.26"],
                    "timestamps": [
                        "2024-01-15 14:30:00",
                        "2024-01-15 14:31:15", 
                        "2024-01-15 14:32:30"
                    ]
                }
            },
            
            "data_exfiltration": {
                "title": "Data Exfiltration Attempt",
                "description": "Large volume of data downloads detected outside business hours",
                "difficulty": "High",
                "estimated_time": "25 minutes",
                "learning_objectives": [
                    "Detect abnormal data access patterns",
                    "Analyze user behavior for insider threats",
                    "Implement data loss prevention measures",
                    "Execute incident containment procedures"
                ],
                "initial_state": {
                    "suspicious_downloads": [
                        {"user": "john.doe", "file": "work_orders_export_2024.csv", "size_mb": 150, "time": "02:30:00"},
                        {"user": "john.doe", "file": "customer_data_dump.json", "size_mb": 89, "time": "02:35:00"},
                        {"user": "john.doe", "file": "user_credentials_backup.txt", "size_mb": 5, "time": "02:40:00"}
                    ],
                    "normal_business_hours": {"start": "09:00", "end": "17:00"},
                    "user_profile": {
                        "name": "John Doe",
                        "role": "Technician", 
                        "department": "Field Operations",
                        "access_level": "Standard",
                        "last_review": "2023-12-01",
                        "normal_access_pattern": "Business hours only, small file downloads"
                    },
                    "access_logs": [
                        {"time": "02:25:00", "action": "login", "ip": "10.0.0.50"},
                        {"time": "02:30:00", "action": "export_work_orders", "records": 15000},
                        {"time": "02:35:00", "action": "export_customers", "records": 5000},
                        {"time": "02:40:00", "action": "access_admin_panel", "success": True},
                        {"time": "02:45:00", "action": "download_backup", "file": "credentials"}
                    ]
                }
            },
            
            "phishing_attack": {
                "title": "Phishing Attack Response",
                "description": "Users reporting suspicious emails requesting WorkFossa credentials",
                "difficulty": "Medium",
                "estimated_time": "18 minutes", 
                "learning_objectives": [
                    "Identify phishing attack indicators",
                    "Coordinate user communication and training",
                    "Implement email security measures",
                    "Track and remediate compromised accounts"
                ],
                "initial_state": {
                    "phishing_email": {
                        "from": "security@workfossa-updates.com",
                        "subject": "URGENT: Verify Your WorkFossa Account",
                        "body": "Your WorkFossa account requires immediate verification. Click here to avoid suspension: http://workfossa-verify.malicious-site.com",
                        "recipients": ["user1@company.com", "user2@company.com", "admin@company.com"],
                        "clicked_users": ["user1@company.com", "user2@company.com"],
                        "submitted_credentials": ["user2@company.com"]
                    },
                    "user_reports": [
                        {"user": "user1@company.com", "report_time": "11:30:00", "action": "Clicked link but didn't enter credentials"},
                        {"user": "user2@company.com", "report_time": "11:45:00", "action": "Entered username and password"},
                        {"user": "admin@company.com", "report_time": "11:50:00", "action": "Identified as phishing, reported to IT"}
                    ],
                    "malicious_domain": "workfossa-verify.malicious-site.com",
                    "legitimate_domain": "app.workfossa.com"
                }
            },
            
            "ransomware_attack": {
                "title": "Ransomware Incident Response",
                "description": "File encryption detected on multiple systems",
                "difficulty": "Critical",
                "estimated_time": "30 minutes",
                "learning_objectives": [
                    "Execute ransomware containment procedures",
                    "Assess backup integrity and recovery options",
                    "Coordinate with law enforcement and legal teams",
                    "Implement business continuity measures"
                ],
                "initial_state": {
                    "affected_systems": [
                        {"hostname": "fossawork-server-01", "files_encrypted": 15000, "encryption_started": "08:30:00"},
                        {"hostname": "fossawork-server-02", "files_encrypted": 8500, "encryption_started": "08:35:00"},
                        {"hostname": "workstation-05", "files_encrypted": 3200, "encryption_started": "08:40:00"}
                    ],
                    "ransom_note": {
                        "filename": "README_DECRYPT.txt",
                        "content": "Your files have been encrypted. Pay 5 Bitcoin to recover them. Contact: criminal@darkweb.onion",
                        "bitcoin_address": "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa"
                    },
                    "encryption_extension": ".locked",
                    "patient_zero": "workstation-05",
                    "attack_vector": "Malicious email attachment",
                    "backup_status": {
                        "last_backup": "2024-01-14 23:00:00",
                        "backup_location": "offsite_storage",
                        "backup_integrity": "unknown"
                    }
                }
            }
        }
    
    async def start_simulation(self, scenario_name: str, user_name: str = "Anonymous"):
        """Start a security simulation scenario"""
        
        if scenario_name not in self.scenarios:
            print(f"❌ Scenario '{scenario_name}' not found")
            return
        
        self.current_scenario = self.scenarios[scenario_name]
        self.user_responses = []
        self.score = 0
        self.start_time = datetime.now()
        
        # Create simulation session
        session_id = self.create_simulation_session(user_name, scenario_name)
        
        print(f"\n🎭 SECURITY SIMULATION: {self.current_scenario['title']}")
        print(f"👤 User: {user_name}")
        print(f"📈 Difficulty: {self.current_scenario['difficulty']}")
        print(f"⏱️  Estimated Time: {self.current_scenario['estimated_time']}")
        print("=" * 80)
        
        print(f"\n📖 SCENARIO DESCRIPTION:")
        print(f"{self.current_scenario['description']}")
        
        print(f"\n🎯 LEARNING OBJECTIVES:")
        for i, objective in enumerate(self.current_scenario['learning_objectives'], 1):
            print(f"{i}. {objective}")
        
        print(f"\n⚠️  INCIDENT ALERT:")
        print(f"Time: {datetime.now().strftime('%H:%M:%S')}")
        print(f"Severity: HIGH")
        print(f"Status: ACTIVE INCIDENT")
        
        await self.wait_for_user()
        
        # Run scenario-specific simulation
        if scenario_name == "credential_compromise":
            await self.run_credential_compromise_simulation(session_id)
        elif scenario_name == "sql_injection_attack":
            await self.run_sql_injection_simulation(session_id)
        elif scenario_name == "data_exfiltration":
            await self.run_data_exfiltration_simulation(session_id)
        elif scenario_name == "phishing_attack":
            await self.run_phishing_simulation(session_id)
        elif scenario_name == "ransomware_attack":
            await self.run_ransomware_simulation(session_id)
        
        # Complete simulation
        await self.complete_simulation(session_id, user_name)
    
    async def run_credential_compromise_simulation(self, session_id: int):
        """Run credential compromise scenario"""
        
        state = self.current_scenario['initial_state']
        
        print(f"\n🔍 STEP 1: INCIDENT DETECTION")
        print("Monitoring system has detected the following suspicious activity:")
        print()
        
        print("Recent Login Attempts:")
        print("Time     | User     | IP Address    | Result")
        print("-" * 50)
        
        for login in state['failed_logins']:
            status = "✅ SUCCESS" if login['success'] else "❌ FAILED"
            print(f"{login['time']} | {login['user']:<8} | {login['ip']:<13} | {status}")
        
        await self.wait_for_user()
        
        # Step 1: Detection Analysis
        response1 = await self.get_user_response(
            "QUESTION 1: What suspicious patterns do you observe in the login data?",
            [
                "A) Multiple failed attempts from same IP",
                "B) Successful login from new geographic location", 
                "C) Account access outside normal hours",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="All patterns indicate potential credential compromise: brute force attempts, successful login from new location, and unusual timing.",
            points=20
        )
        
        self.log_security_event(session_id, "detection_analysis", response1)
        
        # Step 2: Immediate Response
        print(f"\n🚨 STEP 2: IMMEDIATE RESPONSE")
        print("You have identified a potential credential compromise. What is your immediate action?")
        
        response2 = await self.get_user_response(
            "QUESTION 2: What should be your FIRST immediate action?",
            [
                "A) Change all user passwords immediately",
                "B) Disable the compromised account and terminate active sessions",
                "C) Call the user to verify legitimate access",
                "D) Monitor for additional suspicious activity"
            ],
            correct_answer="B",
            explanation="Immediate containment by disabling the account prevents further unauthorized access. Other actions follow after containment.",
            points=25
        )
        
        self.log_security_event(session_id, "immediate_response", response2)
        
        if response2['selected'] == "B":
            print(f"\n✅ ACCOUNT DISABLED")
            print("- Admin account has been disabled")
            print("- All active sessions terminated") 
            print("- Access attempts now blocked")
            await asyncio.sleep(2)
        else:
            print(f"\n⚠️  SIMULATION NOTE: In a real incident, immediate containment would be critical")
            await asyncio.sleep(2)
        
        # Step 3: Investigation
        print(f"\n🔍 STEP 3: INVESTIGATION")
        print("Active sessions before containment:")
        
        for session in state['active_sessions']:
            print(f"- User: {session['user']}, IP: {session['ip']}, Session: {session['session_id']}")
        
        response3 = await self.get_user_response(
            "QUESTION 3: What evidence suggests the admin account was compromised?",
            [
                "A) The successful login from suspicious IP 203.0.113.50",
                "B) Multiple failed attempts followed by successful login",
                "C) Login from IP not in normal user IP range", 
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="All indicators point to compromise: suspicious IP, failed attempts suggesting brute force, and geographic anomaly.",
            points=20
        )
        
        self.log_security_event(session_id, "investigation", response3)
        
        # Step 4: Communication
        print(f"\n📞 STEP 4: COMMUNICATION")
        print("You need to communicate this incident. Who should be notified first?")
        
        response4 = await self.get_user_response(
            "QUESTION 4: What is the correct notification order?",
            [
                "A) User → Manager → Security Team → IT",
                "B) Security Team → Manager → User → Legal",
                "C) IT → Security Team → Manager → User",
                "D) Manager → User → IT → Security Team"
            ],
            correct_answer="B",
            explanation="Security team leads incident response, manager provides authority for actions, user confirms legitimate activity, legal assesses exposure.",
            points=15
        )
        
        self.log_security_event(session_id, "communication", response4)
        
        # Step 5: Remediation
        print(f"\n🔧 STEP 5: REMEDIATION")
        print("What remediation steps should be taken? (Select all that apply)")
        
        remediation_options = [
            "A) Force password reset for affected account",
            "B) Review access logs for other affected accounts", 
            "C) Update security monitoring rules",
            "D) Conduct security awareness training",
            "E) All of the above"
        ]
        
        response5 = await self.get_user_response(
            "QUESTION 5: Which remediation steps are necessary?",
            remediation_options,
            correct_answer="E", 
            explanation="Comprehensive remediation includes immediate fixes, investigation expansion, monitoring improvements, and prevention training.",
            points=20
        )
        
        self.log_security_event(session_id, "remediation", response5)
        
        # Scenario completion
        print(f"\n✅ CREDENTIAL COMPROMISE SCENARIO COMPLETE")
        print("Summary of actions taken:")
        print("- ✅ Suspicious activity detected and analyzed")
        print("- ✅ Account disabled and sessions terminated")
        print("- ✅ Evidence collected and documented")
        print("- ✅ Stakeholders notified following protocol")
        print("- ✅ Remediation plan implemented")
    
    async def run_sql_injection_simulation(self, session_id: int):
        """Run SQL injection attack scenario"""
        
        state = self.current_scenario['initial_state']
        
        print(f"\n🔍 STEP 1: ATTACK DETECTION")
        print("Database monitoring has detected suspicious queries:")
        print()
        
        print("Suspicious Database Activity:")
        for i, query in enumerate(state['suspicious_queries'], 1):
            print(f"{i}. {query}")
            print()
        
        await self.wait_for_user()
        
        # Step 1: Attack Pattern Recognition
        response1 = await self.get_user_response(
            "QUESTION 1: What type of attack patterns do you identify?",
            [
                "A) SQL injection with boolean-based blind attack",
                "B) SQL injection with union-based data extraction",
                "C) SQL injection with database destruction attempt",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="The queries show multiple SQL injection techniques: boolean logic manipulation, UNION for data extraction, and DROP statements for destruction.",
            points=25
        )
        
        self.log_security_event(session_id, "attack_recognition", response1)
        
        # Step 2: Impact Assessment
        print(f"\n📊 STEP 2: IMPACT ASSESSMENT")
        print("Affected API endpoints:")
        for endpoint in state['affected_endpoints']:
            print(f"- {endpoint}")
        
        print(f"\nAttack sources:")
        for ip in state['source_ips']:
            print(f"- {ip}")
        
        response2 = await self.get_user_response(
            "QUESTION 2: What is the potential data exposure risk?",
            [
                "A) User credentials may be exposed",
                "B) Work order data may be accessed",
                "C) Database schema information revealed",
                "D) All of the above - critical data breach risk"
            ],
            correct_answer="D",
            explanation="SQL injection can expose all database contents including credentials, work orders, and schema information.",
            points=20
        )
        
        self.log_security_event(session_id, "impact_assessment", response2)
        
        # Step 3: Immediate Containment
        print(f"\n🛡️ STEP 3: IMMEDIATE CONTAINMENT")
        print("What is your immediate containment strategy?")
        
        response3 = await self.get_user_response(
            "QUESTION 3: What should be done FIRST to contain the attack?",
            [
                "A) Block the attacking IP addresses at firewall level",
                "B) Take the database offline immediately",
                "C) Deploy input validation fixes to production",
                "D) Enable database query logging for evidence"
            ],
            correct_answer="A",
            explanation="Immediate IP blocking stops ongoing attacks while preserving service availability. Other actions follow after containment.",
            points=25
        )
        
        self.log_security_event(session_id, "containment", response3)
        
        if response3['selected'] == "A":
            print(f"\n✅ IP ADDRESSES BLOCKED")
            print("- 198.51.100.25 blocked at firewall")
            print("- 198.51.100.26 blocked at firewall")
            print("- Attack traffic stopped")
        
        # Step 4: Code Analysis
        print(f"\n💻 STEP 4: VULNERABILITY ANALYSIS")
        print("Examining vulnerable code patterns...")
        
        vulnerable_code = '''
def search_work_orders(store_number: str):
    query = f"SELECT * FROM work_orders WHERE store_number = '{store_number}'"
    return execute_query(query)
'''
        
        print("Vulnerable code found:")
        print(vulnerable_code)
        
        response4 = await self.get_user_response(
            "QUESTION 4: What is the primary vulnerability in this code?",
            [
                "A) Missing input validation",
                "B) Direct string concatenation in SQL query",
                "C) No parameterized query usage",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="The code lacks input validation, uses dangerous string concatenation, and doesn't use parameterized queries - all creating SQL injection risk.",
            points=20
        )
        
        self.log_security_event(session_id, "code_analysis", response4)
        
        # Step 5: Remediation
        print(f"\n🔧 STEP 5: REMEDIATION IMPLEMENTATION")
        
        secure_code = '''
def search_work_orders(store_number: str):
    # Input validation
    if not store_number.isdigit() or len(store_number) != 4:
        raise ValueError("Invalid store number format")
    
    # Parameterized query
    query = "SELECT * FROM work_orders WHERE store_number = ?"
    return execute_query(query, (store_number,))
'''
        
        print("Proposed secure code:")
        print(secure_code)
        
        response5 = await self.get_user_response(
            "QUESTION 5: What additional security measures should be implemented?",
            [
                "A) Web Application Firewall (WAF) rules",
                "B) Database query monitoring and alerting",
                "C) Regular security code reviews",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="Comprehensive security requires multiple layers: WAF for filtering, monitoring for detection, and code reviews for prevention.",
            points=10
        )
        
        self.log_security_event(session_id, "remediation_planning", response5)
        
        print(f"\n✅ SQL INJECTION SCENARIO COMPLETE")
        print("Attack successfully contained and remediated!")
    
    async def run_data_exfiltration_simulation(self, session_id: int):
        """Run data exfiltration scenario"""
        
        state = self.current_scenario['initial_state']
        
        print(f"\n🔍 STEP 1: ANOMALY DETECTION")
        print("Data Loss Prevention (DLP) system has triggered alerts:")
        print()
        
        print("Suspicious Data Downloads (Outside Business Hours):")
        print("Time     | User     | File                           | Size")
        print("-" * 70)
        
        for download in state['suspicious_downloads']:
            print(f"{download['time']} | {download['user']:<8} | {download['file']:<30} | {download['size_mb']} MB")
        
        print(f"\nBusiness Hours: {state['normal_business_hours']['start']} - {state['normal_business_hours']['end']}")
        
        await self.wait_for_user()
        
        # Step 1: Anomaly Analysis
        response1 = await self.get_user_response(
            "QUESTION 1: What indicators suggest this is a potential insider threat?",
            [
                "A) Downloads occurred outside business hours",
                "B) Large volume of sensitive data accessed",
                "C) Unusual file types for user's role",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="All factors indicate potential insider threat: timing, volume, and file types inconsistent with normal user behavior.",
            points=20
        )
        
        self.log_security_event(session_id, "anomaly_analysis", response1)
        
        # Step 2: User Profile Analysis
        print(f"\n👤 STEP 2: USER PROFILE ANALYSIS")
        profile = state['user_profile']
        
        print("User Profile:")
        print(f"- Name: {profile['name']}")
        print(f"- Role: {profile['role']}")
        print(f"- Department: {profile['department']}")
        print(f"- Access Level: {profile['access_level']}")
        print(f"- Last Security Review: {profile['last_review']}")
        print(f"- Normal Pattern: {profile['normal_access_pattern']}")
        
        response2 = await self.get_user_response(
            "QUESTION 2: What authorization concern do you identify?",
            [
                "A) User accessed admin panel beyond their role",
                "B) User downloaded credential files without authorization",
                "C) User's access review is overdue",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="Multiple authorization failures: role escalation, unauthorized file access, and overdue access review indicate systemic issues.",
            points=20
        )
        
        self.log_security_event(session_id, "profile_analysis", response2)
        
        # Step 3: Immediate Response
        print(f"\n🚨 STEP 3: IMMEDIATE RESPONSE")
        print("This appears to be active data exfiltration. What is your immediate action priority?")
        
        response3 = await self.get_user_response(
            "QUESTION 3: What should be done FIRST?",
            [
                "A) Contact the user to verify legitimate business need",
                "B) Disable user account and terminate active sessions",
                "C) Analyze network logs for additional data transfers",
                "D) Report to management and legal teams"
            ],
            correct_answer="B",
            explanation="Immediate containment prevents further data loss. Investigation and communication follow after stopping the exfiltration.",
            points=25
        )
        
        self.log_security_event(session_id, "immediate_response", response3)
        
        if response3['selected'] == "B":
            print(f"\n✅ ACCOUNT CONTAINMENT EXECUTED")
            print("- User account disabled")
            print("- Active sessions terminated")
            print("- Network access revoked")
            print("- File access blocked")
        
        # Step 4: Forensic Analysis
        print(f"\n🔬 STEP 4: FORENSIC ANALYSIS")
        print("Access log analysis:")
        
        for log_entry in state['access_logs']:
            print(f"- {log_entry['time']}: {log_entry['action']}")
            if 'records' in log_entry:
                print(f"  Records accessed: {log_entry['records']}")
            if 'file' in log_entry:
                print(f"  File type: {log_entry['file']}")
        
        response4 = await self.get_user_response(
            "QUESTION 4: What evidence suggests premeditated data theft?",
            [
                "A) Systematic progression from general to sensitive data",
                "B) Access to admin panel to escalate privileges",
                "C) Large volume downloads suggesting bulk extraction",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="The systematic approach, privilege escalation, and bulk downloads indicate planned insider data theft rather than accidental access.",
            points=20
        )
        
        self.log_security_event(session_id, "forensic_analysis", response4)
        
        # Step 5: Damage Assessment
        print(f"\n📊 STEP 5: DAMAGE ASSESSMENT & RESPONSE")
        
        response5 = await self.get_user_response(
            "QUESTION 5: What regulatory notifications may be required?",
            [
                "A) GDPR breach notification (72 hours)",
                "B) Customer notification of data exposure",
                "C) Law enforcement reporting for theft",
                "D) All of the above depending on data types"
            ],
            correct_answer="D",
            explanation="Data exfiltration may trigger multiple regulatory requirements depending on data types and jurisdictions involved.",
            points=15
        )
        
        self.log_security_event(session_id, "damage_assessment", response5)
        
        print(f"\n✅ DATA EXFILTRATION SCENARIO COMPLETE")
        print("Incident contained and investigation initiated!")
    
    async def run_phishing_simulation(self, session_id: int):
        """Run phishing attack scenario"""
        
        state = self.current_scenario['initial_state']
        
        print(f"\n📧 STEP 1: PHISHING EMAIL ANALYSIS")
        print("Users have reported a suspicious email. Analyzing the phishing attempt:")
        print()
        
        email = state['phishing_email']
        print(f"From: {email['from']}")
        print(f"Subject: {email['subject']}")
        print(f"Body: {email['body']}")
        print()
        print(f"Recipients: {len(email['recipients'])} users")
        print(f"Users who clicked: {len(email['clicked_users'])}")
        print(f"Users who entered credentials: {len(email['submitted_credentials'])}")
        
        await self.wait_for_user()
        
        # Step 1: Phishing Indicators
        response1 = await self.get_user_response(
            "QUESTION 1: What indicators reveal this is a phishing email?",
            [
                "A) Suspicious sender domain (workfossa-updates.com)",
                "B) Urgency and threat language ('URGENT', 'suspension')",
                "C) Malicious URL (workfossa-verify.malicious-site.com)",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="Classic phishing indicators: domain spoofing, urgency tactics, and malicious URLs designed to steal credentials.",
            points=20
        )
        
        self.log_security_event(session_id, "phishing_indicators", response1)
        
        # Step 2: Impact Assessment
        print(f"\n📊 STEP 2: IMPACT ASSESSMENT")
        print("User interaction analysis:")
        
        for report in state['user_reports']:
            print(f"- {report['user']}: {report['action']} at {report['report_time']}")
        
        response2 = await self.get_user_response(
            "QUESTION 2: Which user requires immediate credential reset?",
            [
                "A) user1@company.com (clicked link only)",
                "B) user2@company.com (entered credentials)", 
                "C) admin@company.com (identified phishing)",
                "D) All users should reset passwords"
            ],
            correct_answer="B",
            explanation="user2@company.com submitted credentials to the malicious site, requiring immediate password reset and account monitoring.",
            points=25
        )
        
        self.log_security_event(session_id, "impact_assessment", response2)
        
        # Step 3: Immediate Containment
        print(f"\n🛡️ STEP 3: IMMEDIATE CONTAINMENT")
        
        if response2['selected'] == "B":
            print("✅ CONTAINMENT ACTIONS:")
            print("- user2@company.com account disabled")
            print("- Password reset forced")
            print("- Active sessions terminated")
            print("- Account monitoring enabled")
        
        response3 = await self.get_user_response(
            "QUESTION 3: What should be done about the malicious domain?",
            [
                "A) Block the domain at the firewall level",
                "B) Report the domain to the hosting provider",
                "C) Add domain to email security filters",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="Comprehensive blocking prevents future attacks: network-level blocking, takedown requests, and email filtering.",
            points=20
        )
        
        self.log_security_event(session_id, "domain_containment", response3)
        
        # Step 4: User Communication
        print(f"\n📢 STEP 4: USER COMMUNICATION")
        print("You need to communicate with all users about this phishing attack.")
        
        response4 = await self.get_user_response(
            "QUESTION 4: What should be included in the user communication?",
            [
                "A) Warning about the specific phishing email",
                "B) Instructions to report suspicious emails",
                "C) Reminder about legitimate WorkFossa URLs",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="Comprehensive communication educates users about the specific threat and general phishing awareness.",
            points=15
        )
        
        self.log_security_event(session_id, "user_communication", response4)
        
        # Step 5: Prevention Measures  
        print(f"\n🔒 STEP 5: PREVENTION MEASURES")
        
        response5 = await self.get_user_response(
            "QUESTION 5: What long-term prevention measures should be implemented?",
            [
                "A) Enhanced email security filtering",
                "B) Regular phishing simulation training",
                "C) Multi-factor authentication implementation",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="Layered security approach: technical controls (filtering, MFA) and human factors (training) provide comprehensive protection.",
            points=20
        )
        
        self.log_security_event(session_id, "prevention_measures", response5)
        
        print(f"\n✅ PHISHING ATTACK SCENARIO COMPLETE")
        print("Phishing attack neutralized and users protected!")
    
    async def run_ransomware_simulation(self, session_id: int):
        """Run ransomware incident scenario"""
        
        state = self.current_scenario['initial_state']
        
        print(f"\n🔒 STEP 1: RANSOMWARE DETECTION")
        print("Multiple systems showing signs of file encryption:")
        print()
        
        print("Affected Systems:")
        print("Hostname              | Files Encrypted | Encryption Started")
        print("-" * 60)
        
        for system in state['affected_systems']:
            print(f"{system['hostname']:<20} | {system['files_encrypted']:<15} | {system['encryption_started']}")
        
        print(f"\nRansom note found: {state['ransom_note']['filename']}")
        print(f"Content: {state['ransom_note']['content']}")
        
        await self.wait_for_user()
        
        # Step 1: Immediate Response
        response1 = await self.get_user_response(
            "QUESTION 1: What is the MOST CRITICAL immediate action?",
            [
                "A) Pay the ransom to restore files quickly",
                "B) Isolate all affected systems from the network immediately",
                "C) Attempt to decrypt files using available tools",
                "D) Contact law enforcement first"
            ],
            correct_answer="B",
            explanation="Network isolation prevents ransomware spread to additional systems. Payment encourages attacks and doesn't guarantee recovery.",
            points=30
        )
        
        self.log_security_event(session_id, "immediate_response", response1)
        
        if response1['selected'] == "B":
            print(f"\n✅ NETWORK ISOLATION EXECUTED")
            print("- All affected systems disconnected from network")
            print("- Preventing lateral movement")
            print("- Protecting unaffected systems")
        
        # Step 2: Damage Assessment
        print(f"\n📊 STEP 2: DAMAGE ASSESSMENT")
        print("Analyzing the scope of the attack:")
        
        total_files = sum(system['files_encrypted'] for system in state['affected_systems'])
        patient_zero = state['patient_zero']
        attack_vector = state['attack_vector']
        
        print(f"- Total files encrypted: {total_files:,}")
        print(f"- Patient zero: {patient_zero}")
        print(f"- Attack vector: {attack_vector}")
        print(f"- Encryption extension: {state['encryption_extension']}")
        
        response2 = await self.get_user_response(
            "QUESTION 2: What does the attack pattern suggest about containment success?",
            [
                "A) Attack is still spreading - more systems at risk",
                "B) Attack may be contained - timestamps show progression stopped",
                "C) All systems are likely compromised already",
                "D) Cannot determine without more information"
            ],
            correct_answer="B",
            explanation="The 5-minute intervals between systems suggest the attack progressed but may have been contained by network isolation.",
            points=20
        )
        
        self.log_security_event(session_id, "damage_assessment", response2)
        
        # Step 3: Recovery Planning
        print(f"\n💾 STEP 3: RECOVERY PLANNING")
        backup_status = state['backup_status']
        
        print("Backup Status:")
        print(f"- Last backup: {backup_status['last_backup']}")
        print(f"- Backup location: {backup_status['backup_location']}")
        print(f"- Backup integrity: {backup_status['backup_integrity']}")
        
        response3 = await self.get_user_response(
            "QUESTION 3: What is the first step in recovery planning?",
            [
                "A) Immediately restore from backups",
                "B) Verify backup integrity and isolation from infection",
                "C) Rebuild all systems from scratch",
                "D) Negotiate with attackers for decryption"
            ],
            correct_answer="B",
            explanation="Backup integrity verification is critical - compromised backups could reintroduce the ransomware or contain corrupted data.",
            points=25
        )
        
        self.log_security_event(session_id, "recovery_planning", response3)
        
        # Step 4: Legal and Compliance
        print(f"\n⚖️ STEP 4: LEGAL AND COMPLIANCE REQUIREMENTS")
        
        response4 = await self.get_user_response(
            "QUESTION 4: What legal obligations must be considered?",
            [
                "A) Report to law enforcement (FBI/local police)",
                "B) Notify customers of potential data exposure",
                "C) Report to regulatory bodies if personal data affected",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="Ransomware incidents trigger multiple legal requirements: criminal reporting, customer notification, and regulatory compliance.",
            points=15
        )
        
        self.log_security_event(session_id, "legal_compliance", response4)
        
        # Step 5: Business Continuity
        print(f"\n🔄 STEP 5: BUSINESS CONTINUITY")
        
        response5 = await self.get_user_response(
            "QUESTION 5: What business continuity measures should be activated?",
            [
                "A) Switch to manual paper-based processes",
                "B) Activate disaster recovery site if available",
                "C) Communicate with customers about service impacts",
                "D) All of the above"
            ],
            correct_answer="D",
            explanation="Comprehensive business continuity includes backup processes, alternative infrastructure, and stakeholder communication.",
            points=10
        )
        
        self.log_security_event(session_id, "business_continuity", response5)
        
        # Recovery simulation
        print(f"\n🔄 SIMULATED RECOVERY PROCESS")
        print("Backup integrity verified ✅")
        print("Clean recovery environment prepared ✅")
        print("Gradual system restoration in progress...")
        
        for i in range(3):
            await asyncio.sleep(1)
            print(f"Restoring system {i+1}/3... {'✅' if i == 2 else '⏳'}")
        
        print(f"\n✅ RANSOMWARE SCENARIO COMPLETE")
        print("Critical incident contained and recovery initiated!")
    
    async def get_user_response(self, question: str, options: List[str], correct_answer: str, explanation: str, points: int) -> Dict[str, Any]:
        """Get user response to a question"""
        
        print(f"\n❓ {question}")
        print()
        
        for option in options:
            print(f"   {option}")
        
        print()
        
        while True:
            response = input("Your answer (A/B/C/D): ").strip().upper()
            if response in ['A', 'B', 'C', 'D']:
                break
            print("Please enter A, B, C, or D")
        
        is_correct = response == correct_answer
        points_awarded = points if is_correct else 0
        self.score += points_awarded
        
        if is_correct:
            print(f"\n✅ CORRECT! (+{points} points)")
        else:
            print(f"\n❌ INCORRECT. The correct answer was {correct_answer}")
        
        print(f"💡 Explanation: {explanation}")
        
        result = {
            "question": question,
            "options": options,
            "selected": response,
            "correct": correct_answer,
            "is_correct": is_correct,
            "points_awarded": points_awarded,
            "explanation": explanation,
            "timestamp": datetime.now().isoformat()
        }
        
        self.user_responses.append(result)
        return result
    
    async def wait_for_user(self):
        """Wait for user to continue"""
        input("\n⏸️  Press Enter to continue...")
    
    def create_simulation_session(self, user_name: str, scenario_name: str) -> int:
        """Create simulation session in database"""
        conn = sqlite3.connect(self.sim_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO simulation_sessions (user_name, scenario_name, start_time)
            VALUES (?, ?, ?)
        """, (user_name, scenario_name, self.start_time.isoformat()))
        
        session_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return session_id
    
    def log_security_event(self, session_id: int, event_type: str, response_data: Dict[str, Any]):
        """Log security event to database"""
        conn = sqlite3.connect(self.sim_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO security_events (
                session_id, event_type, timestamp, details, 
                user_action, correct_action, points_awarded
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            session_id,
            event_type,
            datetime.now().isoformat(),
            json.dumps(response_data),
            response_data.get('selected', ''),
            response_data.get('correct', ''),
            response_data.get('points_awarded', 0)
        ))
        
        conn.commit()
        conn.close()
    
    async def complete_simulation(self, session_id: int, user_name: str):
        """Complete simulation and show results"""
        
        end_time = datetime.now()
        duration = end_time - self.start_time
        
        # Update session in database
        conn = sqlite3.connect(self.sim_db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE simulation_sessions 
            SET end_time = ?, score = ?, responses = ?, completed = TRUE
            WHERE id = ?
        """, (end_time.isoformat(), self.score, json.dumps(self.user_responses), session_id))
        
        conn.commit()
        conn.close()
        
        # Calculate performance metrics
        total_questions = len(self.user_responses)
        correct_answers = sum(1 for r in self.user_responses if r['is_correct'])
        accuracy = (correct_answers / total_questions) * 100 if total_questions > 0 else 0
        
        # Show results
        print(f"\n🎭 SIMULATION COMPLETE!")
        print("=" * 80)
        print(f"👤 User: {user_name}")
        print(f"📈 Scenario: {self.current_scenario['title']}")
        print(f"⏱️  Duration: {duration.total_seconds():.1f} seconds")
        print(f"🎯 Score: {self.score} points")
        print(f"📊 Accuracy: {accuracy:.1f}% ({correct_answers}/{total_questions})")
        
        # Performance evaluation
        if accuracy >= 90:
            grade = "🥇 EXCELLENT"
        elif accuracy >= 80:
            grade = "🥈 GOOD"
        elif accuracy >= 70:
            grade = "🥉 SATISFACTORY"
        else:
            grade = "📚 NEEDS IMPROVEMENT"
        
        print(f"📝 Grade: {grade}")
        
        # Detailed feedback
        print(f"\n📋 DETAILED FEEDBACK:")
        for i, response in enumerate(self.user_responses, 1):
            status = "✅" if response['is_correct'] else "❌"
            print(f"{i}. {status} {response['points_awarded']} points - {response['question'][:50]}...")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        if accuracy < 80:
            print("- Review security incident response procedures")
            print("- Practice with additional simulation scenarios")
            print("- Study security frameworks (NIST, SANS)")
        
        incorrect_answers = [r for r in self.user_responses if not r['is_correct']]
        if incorrect_answers:
            print("- Focus on areas where incorrect answers were given:")
            for response in incorrect_answers:
                print(f"  • Review: {response['question'][:60]}...")
        
        print(f"\n📚 NEXT STEPS:")
        print("- Complete additional simulation scenarios")
        print("- Review real-world incident case studies")
        print("- Practice with security tools and procedures")
        print("- Schedule follow-up training sessions")

def list_available_scenarios():
    """List all available simulation scenarios"""
    sim = SecuritySimulation()
    
    print("🎭 AVAILABLE SECURITY SIMULATION SCENARIOS")
    print("=" * 80)
    
    for i, (scenario_id, scenario) in enumerate(sim.scenarios.items(), 1):
        print(f"\n{i}. {scenario['title']}")
        print(f"   Difficulty: {scenario['difficulty']}")
        print(f"   Duration: {scenario['estimated_time']}")
        print(f"   Description: {scenario['description']}")
        print(f"   Command: python security-simulation.py {scenario_id}")

async def main():
    """Main simulation runner"""
    
    if len(sys.argv) < 2:
        print("🎭 Security Simulation Training System")
        print("Usage: python security-simulation.py <scenario_name> [user_name]")
        print("\nAvailable scenarios:")
        list_available_scenarios()
        return
    
    scenario_name = sys.argv[1]
    user_name = sys.argv[2] if len(sys.argv) > 2 else "Anonymous"
    
    if scenario_name == "list":
        list_available_scenarios()
        return
    
    sim = SecuritySimulation()
    
    if scenario_name not in sim.scenarios:
        print(f"❌ Scenario '{scenario_name}' not found")
        print("\nAvailable scenarios:")
        for scenario_id in sim.scenarios.keys():
            print(f"- {scenario_id}")
        return
    
    try:
        await sim.start_simulation(scenario_name, user_name)
    except KeyboardInterrupt:
        print(f"\n\n⚠️  Simulation interrupted by user")
        print("Progress has been saved.")
    except Exception as e:
        print(f"\n\n❌ Simulation error: {e}")
        print("Please report this issue to the training team.")

if __name__ == "__main__":
    asyncio.run(main())