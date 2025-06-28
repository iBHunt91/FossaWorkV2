# Deploy Check Command

**What it does:** Runs a comprehensive check to make sure the system is ready for production deployment.

**When to use it:**
- Before deploying to production
- After major changes
- For security compliance checks

**How to use it:**
- `/deploy-check` - Runs all deployment checks

**Example scenario:** You're about to deploy the latest version to production. Type `/deploy-check` and Claude will check for security issues, validate configurations, test migrations, and give you a clear GO/NO-GO decision with any blockers.

**What gets checked:**
- 🔒 Security issues (plain text passwords, API auth)
- ⚙️ Environment variables
- 🗄️ Database migrations
- 📦 Dependencies and versions
- 🔑 SSL/HTTPS configuration
- 📝 Required documentation
- 🧪 Test coverage

**Results:**
- ✅ **GO** - Ready for deployment
- ⛔ **NO-GO** - Critical issues found
- ⚠️ **WARNING** - Non-critical issues

---

## Content

I'll run a comprehensive deployment readiness check.

<task>
1. Check for CRITICAL security issues:
   - Plain text credential storage
   - Missing API authentication
   - Overly permissive CORS
   - Exposed secret keys
2. Validate all required environment variables
3. Test database migration scripts
4. Check for outdated dependencies
5. Verify SSL/HTTPS configuration
6. Ensure monitoring is configured
7. Check backup procedures
8. Validate rate limiting
9. Review input validation
10. Generate deployment checklist with GO/NO-GO recommendation
</task>