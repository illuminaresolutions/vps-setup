import { Logger } from './logger.js';

export class ErrorHandler {
  constructor(logger = new Logger()) {
    this.logger = logger;
    this.errorCounts = new Map();
    this.retryConfigs = new Map();
    this.setupRetryConfigs();
  }

  setupRetryConfigs() {
    // Define retry configurations for different types of operations
    this.retryConfigs.set('network', {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    });

    this.retryConfigs.set('package-install', {
      maxRetries: 2,
      baseDelay: 2000,
      maxDelay: 15000,
      backoffMultiplier: 1.5
    });

    this.retryConfigs.set('file-operation', {
      maxRetries: 3,
      baseDelay: 500,
      maxDelay: 5000,
      backoffMultiplier: 1.2
    });

    this.retryConfigs.set('command-execution', {
      maxRetries: 2,
      baseDelay: 1000,
      maxDelay: 8000,
      backoffMultiplier: 1.5
    });

    this.retryConfigs.set('default', {
      maxRetries: 1,
      baseDelay: 1000,
      maxDelay: 5000,
      backoffMultiplier: 1.5
    });
  }

  async withRetry(operation, operationType = 'default', context = {}) {
    const config = this.retryConfigs.get(operationType) || this.retryConfigs.get('default');
    let lastError = null;

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt <= config.maxRetries) {
          const delay = this.calculateDelay(attempt, config);
          const errorInfo = this.analyzeError(error, context);
          
          this.logger.warn(`⚠️  Attempt ${attempt} failed: ${errorInfo.summary}`);
          this.logger.info(`🔄 Retrying in ${delay}ms... (${attempt}/${config.maxRetries})`);
          
          if (errorInfo.suggestions.length > 0) {
            this.logger.info(`💡 Suggestion: ${errorInfo.suggestions[0]}`);
          }
          
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted
    const finalErrorInfo = this.analyzeError(lastError, context);
    this.logger.error(`❌ Operation failed after ${config.maxRetries + 1} attempts`);
    this.logger.error(`Final error: ${finalErrorInfo.summary}`);
    
    if (finalErrorInfo.suggestions.length > 0) {
      this.logger.error('💡 Suggestions:');
      finalErrorInfo.suggestions.forEach((suggestion, index) => {
        this.logger.error(`   ${index + 1}. ${suggestion}`);
      });
    }

    throw this.createEnhancedError(lastError, finalErrorInfo, context);
  }

  calculateDelay(attempt, config) {
    const delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt - 1);
    return Math.min(delay, config.maxDelay);
  }

  analyzeError(error, context = {}) {
    const errorMessage = error.message || error.toString();
    const errorCode = error.code || error.exitCode || null;
    
    let category = 'unknown';
    let summary = errorMessage;
    let suggestions = [];
    let severity = 'error';

    // Network-related errors
    if (this.isNetworkError(error)) {
      category = 'network';
      summary = 'Network connectivity issue';
      suggestions = [
        'Check your internet connection',
        'Verify DNS settings',
        'Try using a different network',
        'Check firewall settings'
      ];
    }
    
    // Permission errors
    else if (this.isPermissionError(error)) {
      category = 'permission';
      summary = 'Permission denied';
      suggestions = [
        'Run the command with sudo',
        'Check file/directory permissions',
        'Verify user has appropriate access rights'
      ];
    }
    
    // Package manager errors
    else if (this.isPackageManagerError(error)) {
      category = 'package-manager';
      summary = 'Package installation failed';
      suggestions = [
        'Update package lists: sudo apt update',
        'Check available disk space',
        'Verify package repository configuration',
        'Try installing dependencies manually'
      ];
    }
    
    // File system errors
    else if (this.isFileSystemError(error)) {
      category = 'filesystem';
      summary = 'File system operation failed';
      suggestions = [
        'Check available disk space',
        'Verify file/directory permissions',
        'Ensure target location is writable',
        'Check for file locks or conflicts'
      ];
    }
    
    // Command not found errors
    else if (this.isCommandNotFoundError(error)) {
      category = 'command-not-found';
      summary = 'Command or tool not found';
      suggestions = [
        'Install the required package',
        'Check if the command is in PATH',
        'Verify the tool is properly installed',
        'Try using an alternative command'
      ];
    }
    
    // Timeout errors
    else if (this.isTimeoutError(error)) {
      category = 'timeout';
      summary = 'Operation timed out';
      suggestions = [
        'Check network connectivity',
        'Try again with a longer timeout',
        'Verify the target service is responsive',
        'Check system resources'
      ];
    }
    
    // Configuration errors
    else if (this.isConfigurationError(error)) {
      category = 'configuration';
      summary = 'Configuration error';
      suggestions = [
        'Verify configuration file syntax',
        'Check required configuration parameters',
        'Ensure configuration files are readable',
        'Validate configuration against schema'
      ];
    }

    // Add context-specific suggestions
    if (context.operation) {
      suggestions.push(`Review the ${context.operation} operation`);
    }
    
    if (context.phase) {
      suggestions.push(`Check ${context.phase} phase requirements`);
    }

    return {
      category,
      summary,
      suggestions,
      severity,
      originalError: error,
      errorCode,
      context
    };
  }

  isNetworkError(error) {
    const networkKeywords = ['network', 'connection', 'timeout', 'dns', 'host', 'unreachable'];
    const message = error.message?.toLowerCase() || '';
    return networkKeywords.some(keyword => message.includes(keyword)) ||
           error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' ||
           error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH';
  }

  isPermissionError(error) {
    const permissionKeywords = ['permission', 'denied', 'access', 'unauthorized', 'forbidden'];
    const message = error.message?.toLowerCase() || '';
    return permissionKeywords.some(keyword => message.includes(keyword)) ||
           error.code === 'EACCES' || error.code === 'EPERM';
  }

  isPackageManagerError(error) {
    const packageKeywords = ['package', 'dependency', 'install', 'apt', 'dpkg', 'repository'];
    const message = error.message?.toLowerCase() || '';
    return packageKeywords.some(keyword => message.includes(keyword)) ||
           error.code === 'ENOENT' && message.includes('package');
  }

  isFileSystemError(error) {
    const fsKeywords = ['file', 'directory', 'disk', 'space', 'readonly', 'busy'];
    const message = error.message?.toLowerCase() || '';
    return fsKeywords.some(keyword => message.includes(keyword)) ||
           error.code === 'ENOSPC' || error.code === 'EROFS' || error.code === 'EBUSY';
  }

  isCommandNotFoundError(error) {
    const message = error.message?.toLowerCase() || '';
    return message.includes('command not found') || message.includes('no such file') ||
           error.code === 'ENOENT' && message.includes('command');
  }

  isTimeoutError(error) {
    const message = error.message?.toLowerCase() || '';
    return message.includes('timeout') || message.includes('timed out') ||
           error.code === 'ETIMEDOUT';
  }

  isConfigurationError(error) {
    const configKeywords = ['config', 'configuration', 'invalid', 'syntax', 'format'];
    const message = error.message?.toLowerCase() || '';
    return configKeywords.some(keyword => message.includes(keyword));
  }

  createEnhancedError(originalError, errorInfo, context) {
    const enhancedError = new Error(errorInfo.summary);
    enhancedError.name = 'VpsSetupError';
    enhancedError.category = errorInfo.category;
    enhancedError.suggestions = errorInfo.suggestions;
    enhancedError.severity = errorInfo.severity;
    enhancedError.context = context;
    enhancedError.originalError = originalError;
    enhancedError.errorCode = errorInfo.errorCode;
    
    // Preserve stack trace
    enhancedError.stack = originalError.stack;
    
    return enhancedError;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Graceful degradation helpers
  async withGracefulDegradation(primaryOperation, fallbackOperation, context = {}) {
    try {
      return await this.withRetry(primaryOperation, 'default', context);
    } catch (error) {
      this.logger.warn('⚠️  Primary operation failed, trying fallback...');
      
      try {
        return await this.withRetry(fallbackOperation, 'default', {
          ...context,
          operation: 'fallback'
        });
      } catch (fallbackError) {
        this.logger.error('❌ Both primary and fallback operations failed');
        throw this.createEnhancedError(fallbackError, this.analyzeError(fallbackError, context), context);
      }
    }
  }

  // Error recovery helpers
  async attemptRecovery(error, context = {}) {
    const errorInfo = this.analyzeError(error, context);
    
    switch (errorInfo.category) {
      case 'network':
        return await this.recoverFromNetworkError(error, context);
      case 'permission':
        return await this.recoverFromPermissionError(error, context);
      case 'package-manager':
        return await this.recoverFromPackageManagerError(error, context);
      case 'filesystem':
        return await this.recoverFromFileSystemError(error, context);
      default:
        return false; // No recovery possible
    }
  }

  async recoverFromNetworkError(error, context) {
    this.logger.info('🔧 Attempting network error recovery...');
    
    // Try to ping a reliable host
    try {
      const { execa } = await import('execa');
      await execa('ping', ['-c', '1', '8.8.8.8']);
      this.logger.success('✅ Network connectivity restored');
      return true;
    } catch (pingError) {
      this.logger.error('❌ Network recovery failed');
      return false;
    }
  }

  async recoverFromPermissionError(error, context) {
    this.logger.info('🔧 Attempting permission error recovery...');
    
    // Check if we can elevate privileges
    if (process.getuid && process.getuid() !== 0) {
      this.logger.warn('⚠️  Permission error detected. Consider running with sudo.');
      return false;
    }
    
    return false;
  }

  async recoverFromPackageManagerError(error, context) {
    this.logger.info('🔧 Attempting package manager error recovery...');
    
    try {
      const { execa } = await import('execa');
      await execa('sudo', ['apt', 'update']);
      this.logger.success('✅ Package lists updated');
      return true;
    } catch (updateError) {
      this.logger.error('❌ Package manager recovery failed');
      return false;
    }
  }

  async recoverFromFileSystemError(error, context) {
    this.logger.info('🔧 Attempting file system error recovery...');
    
    // Check disk space
    try {
      const { execa } = await import('execa');
      const { stdout } = await execa('df', ['-h', '/']);
      this.logger.info(`📊 Disk usage: ${stdout}`);
      return false; // Manual intervention required
    } catch (dfError) {
      this.logger.error('❌ Could not check disk space');
      return false;
    }
  }

  // Error reporting and statistics
  recordError(category, context = {}) {
    const key = `${category}:${context.operation || 'unknown'}`;
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  getErrorStatistics() {
    const stats = {};
    for (const [key, count] of this.errorCounts) {
      const [category, operation] = key.split(':');
      if (!stats[category]) {
        stats[category] = {};
      }
      stats[category][operation] = count;
    }
    return stats;
  }

  generateErrorReport() {
    const stats = this.getErrorStatistics();
    const totalErrors = Object.values(stats).reduce((sum, category) => 
      sum + Object.values(category).reduce((catSum, count) => catSum + count, 0), 0
    );

    return {
      totalErrors,
      errorBreakdown: stats,
      recommendations: this.generateRecommendations(stats)
    };
  }

  generateRecommendations(stats) {
    const recommendations = [];
    
    if (stats.network) {
      recommendations.push('Check network connectivity and firewall settings');
    }
    
    if (stats.permission) {
      recommendations.push('Ensure proper permissions or run with elevated privileges');
    }
    
    if (stats['package-manager']) {
      recommendations.push('Update package lists and check repository configuration');
    }
    
    if (stats.filesystem) {
      recommendations.push('Check available disk space and file permissions');
    }
    
    return recommendations;
  }
} 