"""
Security Configuration for FossaWork V2

Centralized security settings for different environments.
Follows OWASP security best practices.

Author: Security Headers Specialist
Date: 2025-01-23
"""

import os
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field


@dataclass
class CSPConfig:
    """Content Security Policy configuration"""
    default_src: List[str] = field(default_factory=lambda: ["'self'"])
    script_src: List[str] = field(default_factory=lambda: ["'self'"])
    style_src: List[str] = field(default_factory=lambda: ["'self'", "'unsafe-inline'"])
    img_src: List[str] = field(default_factory=lambda: ["'self'", "data:", "blob:"])
    font_src: List[str] = field(default_factory=lambda: ["'self'", "data:"])
    connect_src: List[str] = field(default_factory=lambda: ["'self'"])
    frame_ancestors: List[str] = field(default_factory=lambda: ["'none'"])
    base_uri: List[str] = field(default_factory=lambda: ["'self'"])
    form_action: List[str] = field(default_factory=lambda: ["'self'"])
    object_src: List[str] = field(default_factory=lambda: ["'none'"])
    media_src: List[str] = field(default_factory=lambda: ["'self'"])
    manifest_src: List[str] = field(default_factory=lambda: ["'self'"])
    worker_src: List[str] = field(default_factory=lambda: ["'self'", "blob:"])
    upgrade_insecure_requests: bool = False
    report_uri: Optional[str] = None
    report_to: Optional[str] = None


@dataclass
class SecurityHeadersConfig:
    """Complete security headers configuration"""
    csp: CSPConfig
    x_content_type_options: str = "nosniff"
    x_frame_options: str = "DENY"
    x_xss_protection: str = "1; mode=block"
    referrer_policy: str = "strict-origin-when-cross-origin"
    permissions_policy: str = "geolocation=(), microphone=(), camera=(), payment=(), usb=()"
    strict_transport_security: Optional[str] = None
    report_to: Optional[Dict[str, Any]] = None
    
    def to_headers_dict(self) -> Dict[str, str]:
        """Convert configuration to headers dictionary"""
        headers = {
            "X-Content-Type-Options": self.x_content_type_options,
            "X-Frame-Options": self.x_frame_options,
            "X-XSS-Protection": self.x_xss_protection,
            "Referrer-Policy": self.referrer_policy,
            "Permissions-Policy": self.permissions_policy,
        }
        
        if self.strict_transport_security:
            headers["Strict-Transport-Security"] = self.strict_transport_security
        
        if self.report_to:
            import json
            headers["Report-To"] = json.dumps(self.report_to)
        
        # Build CSP header
        csp_parts = []
        csp_dict = {
            "default-src": self.csp.default_src,
            "script-src": self.csp.script_src,
            "style-src": self.csp.style_src,
            "img-src": self.csp.img_src,
            "font-src": self.csp.font_src,
            "connect-src": self.csp.connect_src,
            "frame-ancestors": self.csp.frame_ancestors,
            "base-uri": self.csp.base_uri,
            "form-action": self.csp.form_action,
            "object-src": self.csp.object_src,
            "media-src": self.csp.media_src,
            "manifest-src": self.csp.manifest_src,
            "worker-src": self.csp.worker_src,
        }
        
        for directive, sources in csp_dict.items():
            if sources:
                csp_parts.append(f"{directive} {' '.join(sources)}")
        
        if self.csp.upgrade_insecure_requests:
            csp_parts.append("upgrade-insecure-requests")
        
        if self.csp.report_uri:
            csp_parts.append(f"report-uri {self.csp.report_uri}")
        
        if self.csp.report_to:
            csp_parts.append(f"report-to {self.csp.report_to}")
        
        headers["Content-Security-Policy"] = "; ".join(csp_parts)
        
        return headers


class SecurityConfigFactory:
    """Factory for creating environment-specific security configurations"""
    
    @staticmethod
    def get_development_config() -> SecurityHeadersConfig:
        """Development environment configuration - more permissive"""
        csp = CSPConfig(
            script_src=["'self'", "'unsafe-eval'", "http://localhost:*", "ws://localhost:*"],
            connect_src=["'self'", "http://localhost:*", "ws://localhost:*", "https://app.workfossa.com"],
            style_src=["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        )
        
        return SecurityHeadersConfig(
            csp=csp,
            # No HSTS in development
            strict_transport_security=None
        )
    
    @staticmethod
    def get_staging_config() -> SecurityHeadersConfig:
        """Staging environment configuration - balanced security"""
        staging_domain = os.getenv("STAGING_DOMAIN", "staging.fossawork.com")
        
        csp = CSPConfig(
            script_src=["'self'", f"https://{staging_domain}"],
            connect_src=["'self'", f"https://{staging_domain}", f"wss://{staging_domain}", "https://app.workfossa.com"],
            report_uri=os.getenv("STAGING_CSP_REPORT_URI")
        )
        
        return SecurityHeadersConfig(
            csp=csp,
            strict_transport_security="max-age=86400; includeSubDomains"  # 1 day for staging
        )
    
    @staticmethod
    def get_production_config() -> SecurityHeadersConfig:
        """Production environment configuration - strictest security"""
        prod_domain = os.getenv("PRODUCTION_DOMAIN", "app.fossawork.com")
        report_uri = os.getenv("SECURITY_REPORT_URI", "")
        
        csp = CSPConfig(
            script_src=["'self'", f"https://{prod_domain}"],
            connect_src=["'self'", f"https://{prod_domain}", f"wss://{prod_domain}", "https://app.workfossa.com"],
            upgrade_insecure_requests=True,
            report_uri=report_uri if report_uri else None,
            report_to="default" if report_uri else None
        )
        
        report_to_config = None
        if report_uri:
            report_to_config = {
                "group": "default",
                "max_age": 31536000,  # 1 year
                "endpoints": [{"url": report_uri}],
                "include_subdomains": True
            }
        
        return SecurityHeadersConfig(
            csp=csp,
            strict_transport_security="max-age=31536000; includeSubDomains; preload",  # 1 year with preload
            report_to=report_to_config
        )
    
    @staticmethod
    def get_config(environment: Optional[str] = None) -> SecurityHeadersConfig:
        """Get configuration for specified environment"""
        env = environment or os.getenv("ENVIRONMENT", "development")
        
        if env == "development":
            return SecurityConfigFactory.get_development_config()
        elif env == "staging":
            return SecurityConfigFactory.get_staging_config()
        elif env == "production":
            return SecurityConfigFactory.get_production_config()
        else:
            # Default to development for unknown environments
            return SecurityConfigFactory.get_development_config()


# Additional security utilities

def validate_csp_nonce(nonce: str) -> bool:
    """
    Validate a CSP nonce value.
    
    Args:
        nonce: The nonce to validate
        
    Returns:
        True if valid, False otherwise
    """
    import re
    # Nonce should be base64 encoded and at least 128 bits (16 bytes = 22 base64 chars)
    pattern = r'^[A-Za-z0-9+/]{22,}={0,2}$'
    return bool(re.match(pattern, nonce))


def generate_csp_nonce() -> str:
    """
    Generate a secure CSP nonce.
    
    Returns:
        Base64-encoded nonce
    """
    import secrets
    import base64
    # Generate 16 bytes (128 bits) of random data
    random_bytes = secrets.token_bytes(16)
    return base64.b64encode(random_bytes).decode('ascii')


def get_api_security_headers() -> Dict[str, str]:
    """
    Get minimal security headers for API responses.
    
    Returns:
        Dictionary of security headers for API endpoints
    """
    return {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Cache-Control": "no-store, no-cache, must-revalidate, private",
        "Pragma": "no-cache",
        "Expires": "0"
    }