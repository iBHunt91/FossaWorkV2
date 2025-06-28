// Service for parsing and formatting test results
export interface TestResult {
  name: string;
  passed: boolean;
  message: string;
  error?: string;
  testedAt?: string;
  responseTime?: number;
  details?: any;
}

export interface TestCategory {
  name: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  notTested: number;
}

export interface TestSummary {
  totalTests: number;
  passedTests: number;
  failedTests: number;
  notTested: number;
  categories: TestCategory[];
  timestamp: string;
  backendStatus: 'online' | 'offline';
}

export class TestResultsService {
  // Parse test results from the Testing Dashboard API response
  static parseTestResults(results: any): TestSummary {
    const timestamp = new Date().toLocaleString();
    const categories: Record<string, TestCategory> = {};
    
    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    let notTested = 0;

    // Process all test results
    Object.entries(results).forEach(([key, value]) => {
      if (key === 'summary' || key === 'timestamp' || !value) return;
      
      const categoryName = this.getCategoryName(key);
      if (!categories[categoryName]) {
        categories[categoryName] = {
          name: categoryName,
          tests: [],
          totalTests: 0,
          passedTests: 0,
          failedTests: 0,
          notTested: 0
        };
      }

      const test = this.parseIndividualTest(key, value);
      categories[categoryName].tests.push(test);
      categories[categoryName].totalTests++;
      totalTests++;

      if (test.passed === true) {
        categories[categoryName].passedTests++;
        passedTests++;
      } else if (test.passed === false) {
        categories[categoryName].failedTests++;
        failedTests++;
      } else {
        categories[categoryName].notTested++;
        notTested++;
      }
    });

    return {
      totalTests,
      passedTests,
      failedTests,
      notTested,
      categories: Object.values(categories),
      timestamp,
      backendStatus: 'online'
    };
  }

  // Parse an individual test result
  private static parseIndividualTest(key: string, value: any): TestResult {
    const name = this.getTestName(key);
    let passed: boolean | undefined;
    let message = '';
    let error: string | undefined;
    let testedAt: string | undefined;
    let responseTime: number | undefined;
    let details: any;

    // Handle different test result formats
    if (typeof value === 'object' && value !== null) {
      if ('success' in value) {
        passed = value.success;
      } else if ('passed' in value) {
        passed = value.passed;
      } else if ('status' in value) {
        passed = value.status === 'passed' || value.status === 'success';
      } else if ('error' in value && value.error) {
        passed = false;
      }

      message = value.message || value.msg || value.description || '';
      error = value.error || value.errorMessage;
      testedAt = value.testedAt || value.timestamp;
      responseTime = value.responseTime || value.duration;
      details = value.details || value.data || value.result;
    } else if (typeof value === 'boolean') {
      passed = value;
    } else if (typeof value === 'string') {
      message = value;
      passed = !value.toLowerCase().includes('failed') && !value.toLowerCase().includes('error');
    }

    return {
      name,
      passed: passed ?? undefined,
      message,
      error,
      testedAt,
      responseTime,
      details
    };
  }

  // Get category name from test key
  private static getCategoryName(key: string): string {
    const categoryMap: Record<string, string> = {
      // Authentication
      'login': 'Authentication',
      'token': 'Authentication',
      'jwt': 'Authentication',
      'auth': 'Authentication',
      'user_session': 'Authentication',
      'logout': 'Authentication',
      
      // Database
      'database': 'Database',
      'db': 'Database',
      'table': 'Database',
      'query': 'Database',
      
      // Web Scraping
      'scraping': 'Web Scraping',
      'scraper': 'Web Scraping',
      'workfossa': 'Web Scraping',
      'work_order_scrape': 'Web Scraping',
      'dispenser_scrape': 'Web Scraping',
      
      // Form Automation
      'automation': 'Form Automation',
      'browser': 'Form Automation',
      'form': 'Form Automation',
      'playwright': 'Form Automation',
      
      // Notifications
      'email': 'Notifications',
      'smtp': 'Notifications',
      'pushover': 'Notifications',
      'desktop_notification': 'Notifications',
      'notification': 'Notifications',
      
      // API
      'api': 'API Endpoints',
      'health': 'API Endpoints',
      'rate_limit': 'API Endpoints',
      'version': 'API Endpoints',
      
      // Filters
      'filter': 'Filter System',
      
      // User Management
      'user': 'User Management',
      'permission': 'User Management',
      
      // Work Week
      'work_week': 'Work Week Configuration',
      'weekend': 'Work Week Configuration',
      'week_range': 'Work Week Configuration',
      
      // Scheduler
      'scheduler': 'Scheduler',
      'schedule': 'Scheduler',
      'sync': 'Scheduler'
    };

    const lowerKey = key.toLowerCase();
    for (const [pattern, category] of Object.entries(categoryMap)) {
      if (lowerKey.includes(pattern)) {
        return category;
      }
    }

    return 'Other Tests';
  }

  // Get readable test name from key
  private static getTestName(key: string): string {
    const nameMap: Record<string, string> = {
      'check_auth_status': 'Check Authentication Status',
      'validate_jwt': 'Validate JWT Token',
      'user_session': 'User Session Management',
      'logout': 'Logout Functionality',
      
      'database_connection': 'Database Connection',
      'table_structure': 'Table Structure',
      'query_performance': 'Query Performance',
      
      'workfossa_connection': 'WorkFossa Connection',
      'work_order_scrape': 'Sample Work Order Scrape',
      'dispenser_scrape': 'Sample Dispenser Scrape',
      
      'automation_service': 'Automation Service',
      'browser_launch': 'Browser Launch Test',
      'form_detection': 'Form Detection',
      
      'email_config': 'Email Configuration',
      'smtp_connection': 'SMTP Connection Test',
      'email_delivery': 'Email Delivery Test',
      'email_templates': 'Email Template Rendering',
      'pushover_config': 'Pushover Configuration',
      'pushover_connection': 'Pushover API Connection',
      'pushover_delivery': 'Pushover Delivery Test',
      'desktop_notification_support': 'Desktop Notification Support',
      'desktop_notification_test': 'Desktop Notification Test',
      'notification_manager': 'Notification Manager Integration',
      
      'health_check': 'API Health Check',
      'api_version': 'API Version',
      'rate_limiting': 'Rate Limiting',
      
      'filter_calculation': 'Filter Calculation Engine',
      'filter_integrity': 'Filter Data Integrity',
      'filter_api': 'Work Order Filter API',
      'filter_modal_format': 'Filter Modal Data Format',
      'filter_modal_integration': 'Work Order Modal Filter Integration',
      'filter_consistency': 'Filter Modal Consistency Check',
      'filter_data_validation': 'Data Format Validation',
      'filter_dashboard': 'Dashboard Filter Display Integration',
      'filter_work_orders_modal': 'Work Orders Page Modal Filter Display',
      
      'user_isolation': 'User Data Isolation',
      'permission_system': 'Permission System',
      
      'work_week_config': 'Work Week Configuration',
      'weekend_mode': 'Weekend Mode Detection',
      'week_range_calc': 'Week Range Calculations',
      'dashboard_weekend': 'Dashboard Weekend Mode',
      'filters_work_week': 'Filters Work Week',
      
      'scheduler_status': 'Scheduler Service Status',
      'active_schedule': 'Active Schedule Configuration',
      'sync_history': 'Recent Sync History',
      'manual_sync': 'Manual Sync Trigger',
      'next_run_calc': 'Next Run Time Calculation'
    };

    return nameMap[key] || key.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  // Format test results for display
  static formatTestResult(test: TestResult): string {
    let status = '❓';
    if (test.passed === true) status = '✅';
    else if (test.passed === false) status = '❌';
    
    let formatted = `${status} ${test.name}`;
    if (test.message) formatted += `\n   ${test.message}`;
    if (test.error) formatted += `\n   Error: ${test.error}`;
    if (test.responseTime) formatted += ` (${test.responseTime}ms)`;
    
    return formatted;
  }

  // Export results as text
  static exportAsText(summary: TestSummary): string {
    let text = `FossaWork V2 - System Testing Results\n`;
    text += `Generated: ${summary.timestamp}\n`;
    text += `Backend Status: ${summary.backendStatus === 'online' ? 'Online ✅' : 'Offline ❌'}\n`;
    text += `Tests Completed: ${summary.totalTests}\n`;
    text += `Tests Passed: ${summary.passedTests}/${summary.totalTests}\n`;
    text += `Tests Failed: ${summary.failedTests}\n`;
    text += `Not Tested: ${summary.notTested}\n`;
    text += `Progress: ${Math.round((summary.passedTests / summary.totalTests) * 100)}%\n`;
    text += `\n${'='.repeat(60)}\n`;

    summary.categories.forEach(category => {
      text += `\n${category.name} (${category.passedTests}/${category.totalTests})\n`;
      text += `${'-'.repeat(40)}\n`;
      
      category.tests.forEach(test => {
        text += this.formatTestResult(test) + '\n';
      });
    });

    return text;
  }

  // Export results as JSON
  static exportAsJSON(summary: TestSummary): string {
    return JSON.stringify(summary, null, 2);
  }

  // Get status color for a test
  static getStatusColor(test: TestResult): string {
    if (test.passed === true) return 'text-green-600';
    if (test.passed === false) return 'text-red-600';
    return 'text-gray-500';
  }

  // Get status icon for a test
  static getStatusIcon(test: TestResult): string {
    if (test.passed === true) return '✅';
    if (test.passed === false) return '❌';
    return '⚪';
  }

  // Calculate category health score
  static getCategoryHealth(category: TestCategory): 'good' | 'warning' | 'critical' {
    const passRate = category.passedTests / category.totalTests;
    if (passRate >= 0.9) return 'good';
    if (passRate >= 0.7) return 'warning';
    return 'critical';
  }
}