#!/usr/bin/env python3
"""
Incident Response Simulator for FossaWork V2
Advanced incident response training with realistic scenarios
"""

import asyncio
import json
import random
import time
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import sqlite3
from pathlib import Path

class IncidentResponseSimulator:
    """Advanced incident response simulation with realistic timing and complexity"""
    
    def __init__(self):
        self.incidents = self.load_incident_scenarios()
        self.active_incident = None
        self.simulation_state = {}
        self.response_timeline = []
        self.stakeholder_communications = []
        self.evidence_collected = []
        self.score_metrics = {
            "detection_time": 0,
            "response_time": 0, 
            "containment_time": 0,
            "communication_quality": 0,
            "evidence_preservation": 0,
            "recovery_effectiveness": 0
        }
        self.setup_simulation_db()
    
    def setup_simulation_db(self):
        """Set up incident response simulation database"""
        self.db_path = "incident_response_simulations.db"
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incident_simulations (
                id TEXT PRIMARY KEY,
                incident_type TEXT,
                participant_name TEXT,
                start_time TEXT,
                end_time TEXT,
                total_duration INTEGER,
                final_score INTEGER,
                detection_time INTEGER,
                response_time INTEGER,
                containment_time INTEGER,
                communication_score INTEGER,
                evidence_score INTEGER,
                recovery_score INTEGER,
                completed BOOLEAN DEFAULT FALSE
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS incident_actions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                simulation_id TEXT,
                timestamp TEXT,
                action_type TEXT,
                action_description TEXT,
                effectiveness_score INTEGER,
                time_penalty INTEGER,
                stakeholder_impact TEXT,
                FOREIGN KEY (simulation_id) REFERENCES incident_simulations (id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS communication_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                simulation_id TEXT,
                timestamp TEXT,
                communication_type TEXT,
                recipient TEXT,
                message_content TEXT,
                urgency_level TEXT,
                response_time INTEGER,
                effectiveness_rating INTEGER,
                FOREIGN KEY (simulation_id) REFERENCES incident_simulations (id)
            )
        """)
        
        conn.commit()
        conn.close()
    
    def load_incident_scenarios(self) -> Dict[str, Any]:
        """Load realistic incident response scenarios"""
        return {
            "advanced_persistent_threat": {
                "title": "Advanced Persistent Threat (APT) Campaign",
                "severity": "CRITICAL",
                "complexity": "HIGH",
                "estimated_duration": "3-4 hours",
                "description": "Sophisticated nation-state actor has established persistent access to FossaWork V2 infrastructure",
                "initial_indicators": {
                    "unusual_network_traffic": {
                        "timestamp": "2024-01-15 02:30:00",
                        "details": "Encrypted traffic to suspicious IP ranges during off-hours",
                        "detection_method": "Network monitoring system",
                        "severity": "Medium"
                    },
                    "privilege_escalation": {
                        "timestamp": "2024-01-15 02:45:00", 
                        "details": "Service account gained unexpected administrative privileges",
                        "detection_method": "Active Directory audit",
                        "severity": "High"
                    },
                    "lateral_movement": {
                        "timestamp": "2024-01-15 03:10:00",
                        "details": "Multiple systems accessed using legitimate credentials",
                        "detection_method": "Behavioral analysis",
                        "severity": "Critical"
                    }
                },
                "attack_timeline": [
                    {"time": "-30 days", "event": "Initial compromise via spear phishing"},
                    {"time": "-15 days", "event": "Credential harvesting and reconnaissance"},
                    {"time": "-7 days", "event": "Privilege escalation and persistence"},
                    {"time": "-3 days", "event": "Data staging and preparation"},
                    {"time": "0 hours", "event": "Active data exfiltration detected"}
                ],
                "affected_systems": [
                    "fossawork-prod-db-01",
                    "fossawork-prod-app-02", 
                    "fossawork-backup-server",
                    "domain-controller-01"
                ],
                "data_at_risk": [
                    "Customer work order database (50,000+ records)",
                    "User authentication credentials",
                    "WorkFossa integration API keys",
                    "Financial and billing information"
                ],
                "stakeholders": {
                    "internal": ["CEO", "CTO", "Legal Counsel", "Development Team", "Operations Team"],
                    "external": ["Customers", "WorkFossa", "Regulatory Bodies", "Law Enforcement"]
                }
            },
            
            "insider_threat_financial": {
                "title": "Insider Threat - Financial Data Theft",
                "severity": "HIGH",
                "complexity": "MEDIUM",
                "estimated_duration": "2-3 hours",
                "description": "Trusted employee with financial access is stealing customer billing data",
                "initial_indicators": {
                    "unusual_database_access": {
                        "timestamp": "2024-01-15 19:45:00",
                        "details": "Finance team member accessing customer billing data outside normal scope",
                        "detection_method": "Database activity monitoring",
                        "severity": "Medium"
                    },
                    "large_data_download": {
                        "timestamp": "2024-01-15 20:15:00",
                        "details": "Export of 10,000+ customer billing records to personal device",
                        "detection_method": "Data Loss Prevention (DLP)",
                        "severity": "High"
                    },
                    "personal_email_usage": {
                        "timestamp": "2024-01-15 20:30:00",
                        "details": "Large attachment sent to personal email address",
                        "detection_method": "Email security gateway",
                        "severity": "Critical"
                    }
                },
                "insider_profile": {
                    "name": "Sarah Johnson",
                    "role": "Senior Billing Analyst",
                    "department": "Finance",
                    "tenure": "3 years",
                    "access_level": "Financial data, customer billing, payment processing",
                    "recent_events": [
                        "Performance review - below expectations",
                        "Denied promotion request", 
                        "Personal financial difficulties reported by HR"
                    ]
                },
                "evidence_trail": [
                    "Database query logs showing unusual patterns",
                    "File access logs on network shares",
                    "Email metadata and attachments",
                    "Badge access logs showing after-hours presence",
                    "Personal device connection to corporate network"
                ]
            },
            
            "supply_chain_compromise": {
                "title": "Supply Chain Attack - Third-Party Library Compromise",
                "severity": "HIGH", 
                "complexity": "HIGH",
                "estimated_duration": "4-5 hours",
                "description": "Malicious code injected into dependency used by FossaWork V2",
                "initial_indicators": {
                    "build_failure": {
                        "timestamp": "2024-01-15 09:00:00",
                        "details": "Automated deployment pipeline failing with unusual errors",
                        "detection_method": "CI/CD monitoring",
                        "severity": "Low"
                    },
                    "runtime_anomalies": {
                        "timestamp": "2024-01-15 09:30:00",
                        "details": "Application making unexpected network connections",
                        "detection_method": "Runtime security monitoring",
                        "severity": "Medium"
                    },
                    "data_exfiltration": {
                        "timestamp": "2024-01-15 10:15:00",
                        "details": "Sensitive environment variables being transmitted externally",
                        "detection_method": "Network traffic analysis",
                        "severity": "Critical"
                    }
                },
                "compromised_component": {
                    "package_name": "fossawork-utilities",
                    "version": "2.1.5",
                    "repository": "internal npm registry",
                    "last_update": "2024-01-14 23:30:00",
                    "malicious_code": "Credential harvesting and data exfiltration module"
                },
                "impact_assessment": {
                    "applications_affected": 15,
                    "deployment_environments": ["production", "staging", "development"],
                    "data_exposed": ["API keys", "database credentials", "customer data"],
                    "systems_compromised": ["All FossaWork V2 instances"]
                }
            },
            
            "distributed_denial_of_service": {
                "title": "Distributed Denial of Service (DDoS) Attack",
                "severity": "HIGH",
                "complexity": "MEDIUM", 
                "estimated_duration": "2-3 hours",
                "description": "Large-scale DDoS attack targeting FossaWork V2 infrastructure",
                "initial_indicators": {
                    "performance_degradation": {
                        "timestamp": "2024-01-15 14:00:00",
                        "details": "Response times increased from 200ms to 5000ms",
                        "detection_method": "Application performance monitoring",
                        "severity": "Medium"
                    },
                    "traffic_spike": {
                        "timestamp": "2024-01-15 14:05:00",
                        "details": "Incoming requests increased 5000% in 5 minutes",
                        "detection_method": "Load balancer monitoring",
                        "severity": "High"
                    },
                    "service_unavailability": {
                        "timestamp": "2024-01-15 14:10:00",
                        "details": "Application completely unresponsive to legitimate users",
                        "detection_method": "Health check failures",
                        "severity": "Critical"
                    }
                },
                "attack_characteristics": {
                    "attack_type": "Volumetric + Application Layer",
                    "peak_traffic": "50 Gbps",
                    "request_rate": "1,000,000 requests/minute",
                    "attack_vectors": ["UDP flood", "HTTP GET flood", "Slowloris"],
                    "botnet_size": "~100,000 compromised devices",
                    "geographic_distribution": "Global"
                },
                "business_impact": {
                    "customer_impact": "100% service unavailability",
                    "revenue_impact": "$10,000/hour in lost productivity",
                    "reputation_impact": "High - customers unable to access critical work orders",
                    "sla_breach": "Critical SLA violations"
                }
            },
            
            "social_engineering_campaign": {
                "title": "Coordinated Social Engineering Campaign",
                "severity": "MEDIUM",
                "complexity": "MEDIUM",
                "estimated_duration": "2-3 hours", 
                "description": "Sophisticated social engineering targeting multiple employees",
                "initial_indicators": {
                    "phishing_reports": {
                        "timestamp": "2024-01-15 11:00:00",
                        "details": "3 employees report suspicious phone calls claiming to be IT support",
                        "detection_method": "Employee reporting",
                        "severity": "Low"
                    },
                    "credential_testing": {
                        "timestamp": "2024-01-15 11:30:00",
                        "details": "Failed login attempts using employee names and common passwords",
                        "detection_method": "Authentication monitoring",
                        "severity": "Medium"
                    },
                    "successful_compromise": {
                        "timestamp": "2024-01-15 12:00:00",
                        "details": "One employee provided credentials during 'IT support' call",
                        "detection_method": "Unusual access pattern detection",
                        "severity": "High"
                    }
                },
                "attack_methodology": {
                    "reconnaissance": "Social media research, company directory harvesting",
                    "pretext": "IT support requiring password verification for 'security update'",
                    "psychological_tactics": ["Authority", "Urgency", "Social proof"],
                    "technical_elements": ["Caller ID spoofing", "Company-specific terminology"]
                },
                "affected_personnel": [
                    {"name": "Mike Rodriguez", "department": "Operations", "compromised": False},
                    {"name": "Lisa Chen", "department": "Development", "compromised": False}, 
                    {"name": "David Wilson", "department": "Customer Support", "compromised": True}
                ]
            }
        }
    
    async def start_incident_simulation(self, incident_type: str, participant_name: str = "Incident Commander"):
        """Start an incident response simulation"""
        
        if incident_type not in self.incidents:
            print(f"❌ Incident type '{incident_type}' not found")
            return
        
        # Initialize simulation
        simulation_id = str(uuid.uuid4())
        self.active_incident = self.incidents[incident_type]
        self.simulation_state = {
            "id": simulation_id,
            "start_time": datetime.now(),
            "participant": participant_name,
            "incident_detected": False,
            "response_team_activated": False,
            "containment_attempted": False,
            "evidence_preserved": False,
            "communications_sent": False,
            "recovery_initiated": False,
            "phase": "detection"
        }
        
        # Create simulation record
        self.create_simulation_record(simulation_id, incident_type, participant_name)
        
        # Display simulation header
        print(f"\n🚨 INCIDENT RESPONSE SIMULATION")
        print("=" * 80)
        print(f"Incident Type: {self.active_incident['title']}")
        print(f"Severity: {self.active_incident['severity']}")
        print(f"Complexity: {self.active_incident['complexity']}")
        print(f"Incident Commander: {participant_name}")
        print(f"Simulation ID: {simulation_id}")
        print("=" * 80)
        
        print(f"\n⚠️  INCIDENT ALERT")
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Description: {self.active_incident['description']}")
        print(f"Estimated Duration: {self.active_incident['estimated_duration']}")
        
        await self.wait_for_user("\n⏸️  Press Enter to begin incident response simulation...")
        
        # Run simulation phases
        await self.detection_phase(simulation_id)
        await self.analysis_phase(simulation_id)
        await self.containment_phase(simulation_id) 
        await self.eradication_phase(simulation_id)
        await self.recovery_phase(simulation_id)
        await self.lessons_learned_phase(simulation_id)
        
        # Complete simulation
        await self.complete_simulation(simulation_id)
    
    async def detection_phase(self, simulation_id: str):
        """Phase 1: Detection and Initial Analysis"""
        
        print(f"\n🔍 PHASE 1: DETECTION & INITIAL ANALYSIS")
        print("=" * 50)
        
        # Present initial indicators
        indicators = self.active_incident['initial_indicators']
        
        print("Initial security alerts have been triggered:")
        print()
        
        for i, (indicator_name, details) in enumerate(indicators.items(), 1):
            print(f"{i}. {indicator_name.replace('_', ' ').title()}")
            print(f"   Time: {details['timestamp']}")
            print(f"   Details: {details['details']}")
            print(f"   Detection: {details['detection_method']}")
            print(f"   Severity: {details['severity']}")
            print()
        
        await self.wait_for_user()
        
        # Detection assessment
        detection_start = time.time()
        
        decision = await self.get_decision(
            "DECISION POINT 1: How do you assess the situation?",
            [
                "A) These appear to be false positives - no action needed",
                "B) Isolated incidents - investigate individually", 
                "C) Potential coordinated attack - escalate immediately",
                "D) Need more information before deciding"
            ],
            correct_choices=["C"],
            explanation="Multiple correlated security events suggest a coordinated attack requiring immediate escalation."
        )
        
        detection_time = int(time.time() - detection_start)
        self.score_metrics["detection_time"] = max(0, 300 - detection_time)  # 5 minute target
        
        if decision["correct"]:
            print(f"\n✅ CORRECT ASSESSMENT")
            print("You properly identified this as a potential coordinated attack.")
            self.simulation_state["incident_detected"] = True
        else:
            print(f"\n⚠️  SIMULATION IMPACT")
            print("Delayed recognition may allow the attack to progress.")
            # Add time penalty
            await asyncio.sleep(2)
        
        self.log_action(simulation_id, "detection_assessment", decision)
    
    async def analysis_phase(self, simulation_id: str):
        """Phase 2: Analysis and Investigation"""
        
        print(f"\n🔬 PHASE 2: ANALYSIS & INVESTIGATION")
        print("=" * 50)
        
        if "attack_timeline" in self.active_incident:
            print("Investigation reveals the following attack timeline:")
            for event in self.active_incident["attack_timeline"]:
                print(f"  {event['time']}: {event['event']}")
            print()
        
        if "affected_systems" in self.active_incident:
            print("Affected systems identified:")
            for system in self.active_incident["affected_systems"]:
                print(f"  • {system}")
            print()
        
        await self.wait_for_user()
        
        # Analysis decisions
        analysis_decision = await self.get_decision(
            "DECISION POINT 2: What is your investigation priority?",
            [
                "A) Preserve evidence before any remediation",
                "B) Immediately contain the threat to prevent spread",
                "C) Analyze the attack methods and attribution",
                "D) Assess the scope and impact of the breach"
            ],
            correct_choices=["A", "D"],
            explanation="Evidence preservation and impact assessment are critical before containment actions that might destroy forensic evidence."
        )
        
        if analysis_decision["correct"]:
            print(f"\n✅ CORRECT ANALYSIS APPROACH")
            self.simulation_state["evidence_preserved"] = True
            self.score_metrics["evidence_preservation"] = 100
        else:
            print(f"\n⚠️  FORENSIC EVIDENCE COMPROMISED")
            print("Taking immediate action without evidence preservation may harm investigation.")
            self.score_metrics["evidence_preservation"] = 50
        
        # Evidence collection simulation
        print(f"\n📋 EVIDENCE COLLECTION")
        evidence_types = [
            "Network traffic captures", 
            "System memory dumps",
            "Disk images of affected systems",
            "Log files and audit trails",
            "Email and communication records"
        ]
        
        print("Available evidence types:")
        for i, evidence in enumerate(evidence_types, 1):
            print(f"{i}. {evidence}")
        
        evidence_selection = input("\nSelect evidence to collect (1-5, comma separated): ").strip()
        collected_evidence = []
        
        try:
            selections = [int(x.strip()) for x in evidence_selection.split(",")]
            for selection in selections:
                if 1 <= selection <= 5:
                    collected_evidence.append(evidence_types[selection-1])
        except:
            collected_evidence = ["Basic log files"]  # Default if invalid input
        
        self.evidence_collected = collected_evidence
        print(f"\n📦 Evidence collected: {', '.join(collected_evidence)}")
        
        self.log_action(simulation_id, "evidence_collection", {
            "evidence_types": collected_evidence,
            "completeness": len(collected_evidence) / len(evidence_types)
        })
    
    async def containment_phase(self, simulation_id: str):
        """Phase 3: Containment"""
        
        print(f"\n🛡️ PHASE 3: CONTAINMENT")
        print("=" * 50)
        
        containment_start = time.time()
        
        # Present containment options
        containment_decision = await self.get_decision(
            "DECISION POINT 3: What is your containment strategy?",
            [
                "A) Immediate network isolation of all affected systems",
                "B) Selective isolation based on criticality",
                "C) Monitor and gather more intelligence before acting",
                "D) Coordinate with law enforcement before any action"
            ],
            correct_choices=["A", "B"],
            explanation="Rapid containment prevents further damage. Choice between immediate vs selective depends on business needs."
        )
        
        containment_time = int(time.time() - containment_start)
        self.score_metrics["containment_time"] = max(0, 180 - containment_time)  # 3 minute target
        
        if containment_decision["correct"]:
            print(f"\n✅ EFFECTIVE CONTAINMENT")
            print("Threat spread has been stopped.")
            self.simulation_state["containment_attempted"] = True
            
            # Simulate containment actions
            print(f"\n🔒 CONTAINMENT ACTIONS EXECUTED:")
            actions = [
                "Network segments isolated",
                "Affected user accounts disabled", 
                "Suspicious processes terminated",
                "External communication blocked",
                "System snapshots created"
            ]
            
            for action in actions:
                print(f"  ✅ {action}")
                await asyncio.sleep(0.5)
                
        else:
            print(f"\n⚠️  CONTAINMENT DELAYED")
            print("Threat may continue to spread while gathering intelligence.")
            await asyncio.sleep(3)  # Time penalty
        
        # Communication during containment
        await self.handle_stakeholder_communications(simulation_id, "containment")
        
        self.log_action(simulation_id, "containment", containment_decision)
    
    async def eradication_phase(self, simulation_id: str):
        """Phase 4: Eradication"""
        
        print(f"\n🔧 PHASE 4: ERADICATION")
        print("=" * 50)
        
        print("With the threat contained, eradication activities can begin:")
        print()
        
        eradication_tasks = [
            "Remove malware from infected systems",
            "Close attack vectors and patch vulnerabilities", 
            "Reset compromised credentials",
            "Update security controls and rules",
            "Rebuild compromised systems from clean backups"
        ]
        
        print("Eradication tasks required:")
        for i, task in enumerate(eradication_tasks, 1):
            print(f"{i}. {task}")
        
        await self.wait_for_user()
        
        # Eradication decision
        eradication_decision = await self.get_decision(
            "DECISION POINT 4: What is your eradication priority?",
            [
                "A) Patch vulnerabilities before removing malware",
                "B) Remove malware before patching vulnerabilities",
                "C) Reset all credentials before system cleanup",
                "D) Rebuild all systems from scratch immediately"
            ],
            correct_choices=["B"],
            explanation="Malware removal should precede patching to prevent interference with remediation efforts."
        )
        
        if eradication_decision["correct"]:
            print(f"\n✅ EFFECTIVE ERADICATION SEQUENCE")
        else:
            print(f"\n⚠️  ERADICATION CHALLENGES")
            print("Incorrect sequence may complicate remediation efforts.")
        
        # Simulate eradication progress
        print(f"\n🔄 ERADICATION PROGRESS:")
        for i, task in enumerate(eradication_tasks):
            await asyncio.sleep(1)
            print(f"  {'✅' if i < 4 else '⏳'} {task}")
        
        self.log_action(simulation_id, "eradication", eradication_decision)
    
    async def recovery_phase(self, simulation_id: str):
        """Phase 5: Recovery"""
        
        print(f"\n🔄 PHASE 5: RECOVERY")
        print("=" * 50)
        
        recovery_start = time.time()
        
        print("Systems have been cleaned and are ready for recovery:")
        print()
        
        # Recovery decision
        recovery_decision = await self.get_decision(
            "DECISION POINT 5: What is your recovery approach?",
            [
                "A) Restore all systems simultaneously for fastest recovery",
                "B) Gradual recovery with monitoring at each stage",
                "C) Full system rebuild before returning to service",
                "D) Limited recovery with enhanced monitoring"
            ],
            correct_choices=["B"],
            explanation="Gradual recovery with monitoring allows early detection of any remaining threats."
        )
        
        recovery_time = int(time.time() - recovery_start)
        self.score_metrics["recovery_time"] = max(0, 120 - recovery_time)  # 2 minute target
        
        if recovery_decision["correct"]:
            print(f"\n✅ SAFE RECOVERY APPROACH")
            self.simulation_state["recovery_initiated"] = True
            
            # Simulate recovery stages
            print(f"\n📈 RECOVERY STAGES:")
            stages = [
                "Critical systems restored with monitoring",
                "User access gradually re-enabled",
                "Non-critical systems brought online",
                "Full operational capability restored", 
                "Enhanced monitoring confirmed active"
            ]
            
            for stage in stages:
                await asyncio.sleep(1)
                print(f"  ✅ {stage}")
                
        else:
            print(f"\n⚠️  RECOVERY RISKS")
            print("Recovery approach may reintroduce vulnerabilities.")
        
        # Final communications
        await self.handle_stakeholder_communications(simulation_id, "recovery")
        
        self.log_action(simulation_id, "recovery", recovery_decision)
    
    async def lessons_learned_phase(self, simulation_id: str):
        """Phase 6: Lessons Learned"""
        
        print(f"\n📚 PHASE 6: LESSONS LEARNED")
        print("=" * 50)
        
        print("Incident response is complete. Time for post-incident analysis:")
        print()
        
        # Lessons learned assessment
        lessons_decision = await self.get_decision(
            "DECISION POINT 6: What should be the focus of lessons learned?",
            [
                "A) How the attack succeeded and prevention measures",
                "B) Response team performance and improvement areas",
                "C) Communication effectiveness and stakeholder feedback",
                "D) All of the above - comprehensive analysis"
            ],
            correct_choices=["D"],
            explanation="Comprehensive lessons learned should cover prevention, response, and communication improvements."
        )
        
        if lessons_decision["correct"]:
            print(f"\n✅ COMPREHENSIVE ANALYSIS PLANNED")
        else:
            print(f"\n⚠️  LIMITED LEARNING OPPORTUNITY")
        
        # Generate lessons learned report
        print(f"\n📋 LESSONS LEARNED SUMMARY:")
        lessons = [
            "Attack detection could be improved with better correlation rules",
            "Evidence preservation procedures need refinement",
            "Stakeholder communication templates should be updated",
            "Recovery procedures performed effectively",
            "Additional training needed on advanced persistent threats"
        ]
        
        for lesson in lessons:
            print(f"  • {lesson}")
        
        self.log_action(simulation_id, "lessons_learned", lessons_decision)
    
    async def handle_stakeholder_communications(self, simulation_id: str, phase: str):
        """Handle stakeholder communications during incident"""
        
        print(f"\n📞 STAKEHOLDER COMMUNICATIONS - {phase.upper()} PHASE")
        
        stakeholders = self.active_incident.get("stakeholders", {})
        internal = stakeholders.get("internal", [])
        external = stakeholders.get("external", [])
        
        # Communication timing decision
        comm_decision = await self.get_decision(
            f"COMMUNICATION: Who should be notified during {phase}?",
            [
                "A) Internal stakeholders only",
                "B) All stakeholders immediately", 
                "C) Escalate based on incident severity and phase",
                "D) Wait until incident is fully resolved"
            ],
            correct_choices=["C"],
            explanation="Communication should be escalated appropriately based on severity and what information can be safely shared."
        )
        
        if comm_decision["correct"]:
            print(f"\n✅ APPROPRIATE COMMUNICATION TIMING")
            self.score_metrics["communication_quality"] += 20
        else:
            print(f"\n⚠️  COMMUNICATION ISSUES")
            print("Improper timing may cause panic or information leaks.")
            self.score_metrics["communication_quality"] -= 10
        
        # Simulate sending communications
        if phase == "containment":
            recipients = internal[:3]  # Limited internal notification
        elif phase == "recovery":
            recipients = internal + external[:2]  # Broader notification
        else:
            recipients = internal[:2]  # Minimal notification
        
        print(f"\n📧 Communications sent to:")
        for recipient in recipients:
            await asyncio.sleep(0.5)
            print(f"  ✅ {recipient}")
        
        self.stakeholder_communications.append({
            "phase": phase,
            "recipients": recipients,
            "timestamp": datetime.now().isoformat()
        })
    
    async def get_decision(self, question: str, options: List[str], correct_choices: List[str], explanation: str) -> Dict[str, Any]:
        """Get incident response decision from participant"""
        
        print(f"\n❓ {question}")
        print()
        
        for option in options:
            print(f"   {option}")
        
        print()
        
        while True:
            response = input("Your decision (A/B/C/D): ").strip().upper()
            if response in ['A', 'B', 'C', 'D']:
                break
            print("Please enter A, B, C, or D")
        
        is_correct = response in correct_choices
        
        if is_correct:
            print(f"\n✅ GOOD DECISION")
        else:
            print(f"\n⚠️  SUBOPTIMAL DECISION")
            print(f"Recommended choice(s): {', '.join(correct_choices)}")
        
        print(f"💡 Rationale: {explanation}")
        
        return {
            "question": question,
            "options": options,
            "selected": response,
            "correct_choices": correct_choices,
            "correct": is_correct,
            "explanation": explanation,
            "timestamp": datetime.now().isoformat()
        }
    
    async def wait_for_user(self, message: str = "\n⏸️  Press Enter to continue..."):
        """Wait for user input"""
        input(message)
    
    def create_simulation_record(self, simulation_id: str, incident_type: str, participant_name: str):
        """Create simulation record in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO incident_simulations (id, incident_type, participant_name, start_time)
            VALUES (?, ?, ?, ?)
        """, (simulation_id, incident_type, participant_name, datetime.now().isoformat()))
        
        conn.commit()
        conn.close()
    
    def log_action(self, simulation_id: str, action_type: str, action_data: Dict[str, Any]):
        """Log incident response action"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        effectiveness_score = 100 if action_data.get("correct", False) else 50
        
        cursor.execute("""
            INSERT INTO incident_actions (
                simulation_id, timestamp, action_type, action_description, 
                effectiveness_score, time_penalty, stakeholder_impact
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            simulation_id,
            datetime.now().isoformat(),
            action_type,
            json.dumps(action_data),
            effectiveness_score,
            0,  # Could implement time penalties
            "positive" if action_data.get("correct", False) else "neutral"
        ))
        
        conn.commit()
        conn.close()
    
    async def complete_simulation(self, simulation_id: str):
        """Complete incident response simulation"""
        
        end_time = datetime.now()
        total_duration = int((end_time - self.simulation_state["start_time"]).total_seconds())
        
        # Calculate final score
        final_score = sum(self.score_metrics.values()) // len(self.score_metrics)
        
        # Update simulation record
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE incident_simulations SET
                end_time = ?, total_duration = ?, final_score = ?,
                detection_time = ?, response_time = ?, containment_time = ?,
                communication_score = ?, evidence_score = ?, recovery_score = ?,
                completed = TRUE
            WHERE id = ?
        """, (
            end_time.isoformat(), total_duration, final_score,
            self.score_metrics["detection_time"], 
            self.score_metrics["response_time"],
            self.score_metrics["containment_time"],
            self.score_metrics["communication_quality"],
            self.score_metrics["evidence_preservation"],
            self.score_metrics["recovery_effectiveness"],
            simulation_id
        ))
        
        conn.commit()
        conn.close()
        
        # Display results
        print(f"\n🎭 INCIDENT RESPONSE SIMULATION COMPLETE")
        print("=" * 80)
        print(f"Incident: {self.active_incident['title']}")
        print(f"Participant: {self.simulation_state['participant']}")
        print(f"Duration: {total_duration // 60} minutes {total_duration % 60} seconds")
        print(f"Final Score: {final_score}/100")
        
        # Performance breakdown
        print(f"\n📊 PERFORMANCE BREAKDOWN:")
        print(f"Detection Time: {self.score_metrics['detection_time']}/100")
        print(f"Response Time: {self.score_metrics['response_time']}/100") 
        print(f"Containment: {self.score_metrics['containment_time']}/100")
        print(f"Communication: {self.score_metrics['communication_quality']}/100")
        print(f"Evidence Handling: {self.score_metrics['evidence_preservation']}/100")
        print(f"Recovery: {self.score_metrics['recovery_effectiveness']}/100")
        
        # Grade assignment
        if final_score >= 90:
            grade = "🥇 EXCELLENT - Expert level incident response"
        elif final_score >= 80:
            grade = "🥈 GOOD - Solid incident response capabilities"
        elif final_score >= 70:
            grade = "🥉 SATISFACTORY - Basic incident response skills"
        else:
            grade = "📚 NEEDS IMPROVEMENT - Additional training required"
        
        print(f"\n🎯 OVERALL GRADE: {grade}")
        
        # Recommendations
        print(f"\n💡 RECOMMENDATIONS:")
        recommendations = []
        
        if self.score_metrics["detection_time"] < 50:
            recommendations.append("Improve threat detection and analysis skills")
        if self.score_metrics["communication_quality"] < 70:
            recommendations.append("Practice stakeholder communication protocols")
        if self.score_metrics["evidence_preservation"] < 80:
            recommendations.append("Review digital forensics procedures")
        if final_score < 80:
            recommendations.append("Complete additional incident response training")
        
        if recommendations:
            for rec in recommendations:
                print(f"  • {rec}")
        else:
            print("  • Excellent performance - consider leading incident response training")
        
        print(f"\n📈 NEXT STEPS:")
        print("  • Review detailed action log for improvement areas")
        print("  • Practice with additional incident scenarios")
        print("  • Share lessons learned with team")
        print("  • Update incident response procedures based on experience")

def list_available_incidents():
    """List available incident scenarios"""
    simulator = IncidentResponseSimulator()
    
    print("🚨 AVAILABLE INCIDENT RESPONSE SIMULATIONS")
    print("=" * 80)
    
    for i, (incident_id, incident) in enumerate(simulator.incidents.items(), 1):
        print(f"\n{i}. {incident['title']}")
        print(f"   Severity: {incident['severity']}")
        print(f"   Complexity: {incident['complexity']}")
        print(f"   Duration: {incident['estimated_duration']}")
        print(f"   Description: {incident['description']}")
        print(f"   Command: python incident-response-simulator.py {incident_id}")

async def main():
    """Main simulation runner"""
    
    if len(sys.argv) < 2:
        print("🚨 Incident Response Simulation Training")
        print("Usage: python incident-response-simulator.py <incident_type> [participant_name]")
        print("\nAvailable incidents:")
        list_available_incidents()
        return
    
    incident_type = sys.argv[1]
    participant_name = sys.argv[2] if len(sys.argv) > 2 else "Incident Commander"
    
    if incident_type == "list":
        list_available_incidents()
        return
    
    simulator = IncidentResponseSimulator()
    
    if incident_type not in simulator.incidents:
        print(f"❌ Incident type '{incident_type}' not found")
        print("\nAvailable incidents:")
        for incident_id in simulator.incidents.keys():
            print(f"- {incident_id}")
        return
    
    try:
        await simulator.start_incident_simulation(incident_type, participant_name)
    except KeyboardInterrupt:
        print(f"\n\n⚠️  Simulation interrupted")
        print("Partial progress has been saved.")
    except Exception as e:
        print(f"\n\n❌ Simulation error: {e}")

if __name__ == "__main__":
    import sys
    asyncio.run(main())