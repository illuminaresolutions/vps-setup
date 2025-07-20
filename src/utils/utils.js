import fs from 'fs-extra';
import path from 'path';
import os from 'os';

export const Utils = {
  /**
   * Expand tilde in file paths
   */
  expandTilde(filePath) {
    if (filePath.startsWith('~')) {
      return path.join(os.homedir(), filePath.slice(1));
    }
    return filePath;
  },

  /**
   * Ensure directory exists and is writable
   */
  async ensureDirectory(dirPath) {
    const expandedPath = this.expandTilde(dirPath);
    await fs.ensureDir(expandedPath);
    return expandedPath;
  },

  /**
   * Backup a file if it exists
   */
  async backupFile(filePath) {
    const expandedPath = this.expandTilde(filePath);
    
    if (await fs.pathExists(expandedPath)) {
      const backupPath = `${expandedPath}.backup.${Date.now()}`;
      await fs.copy(expandedPath, backupPath);
      return backupPath;
    }
    
    return null;
  },

  /**
   * Generate a unique filename
   */
  generateUniqueFilename(basePath, extension = '') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${basePath}.${timestamp}.${random}${extension}`;
  },

  /**
   * Check if running as root
   */
  isRoot() {
    return process.getuid && process.getuid() === 0;
  },

  /**
   * Get system information
   */
  getSystemInfo() {
    return {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      hostname: os.hostname(),
      username: os.userInfo().username,
      homedir: os.homedir(),
      cpus: os.cpus().length,
      memory: os.totalmem(),
      uptime: os.uptime()
    };
  },

  /**
   * Format bytes to human readable format
   */
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  /**
   * Format duration in seconds to human readable format
   */
  formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  },

  /**
   * Deep merge objects
   */
  deepMerge(target, source) {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(result[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    
    return result;
  },

  /**
   * Debounce function
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Retry function with exponential backoff
   */
  async retry(fn, maxRetries = 3, baseDelay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxRetries) {
          throw error;
        }
        
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  },

  /**
   * Parse command line arguments
   */
  parseArgs(args = process.argv.slice(2)) {
    const parsed = {
      flags: {},
      options: {},
      positional: []
    };
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      if (arg.startsWith('--')) {
        const [key, value] = arg.slice(2).split('=');
        if (value !== undefined) {
          parsed.options[key] = value;
        } else {
          parsed.flags[key] = true;
        }
      } else if (arg.startsWith('-')) {
        const key = arg.slice(1);
        if (i + 1 < args.length && !args[i + 1].startsWith('-')) {
          parsed.options[key] = args[++i];
        } else {
          parsed.flags[key] = true;
        }
      } else {
        parsed.positional.push(arg);
      }
    }
    
    return parsed;
  },

  /**
   * Create a progress tracker
   */
  createProgressTracker(total, description = '') {
    let current = 0;
    
    return {
      increment(amount = 1) {
        current += amount;
        return current;
      },
      set(value) {
        current = value;
        return current;
      },
      get() {
        return current;
      },
      getPercentage() {
        return Math.round((current / total) * 100);
      },
      isComplete() {
        return current >= total;
      },
      getDescription() {
        return description;
      }
    };
  }
}; 