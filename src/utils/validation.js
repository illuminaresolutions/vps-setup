import fs from 'fs-extra';
import { SystemDetector } from './system.js';
import { CommandRunner } from './command.js';
import { Logger } from './logger.js';
import { Utils } from './utils.js';

export class Validator {
  constructor() {
    this.systemDetector = new SystemDetector();
    this.commandRunner = new CommandRunner();
    this.logger = new Logger();
    this.Utils = Utils;
  }

  async validateSystemRequirements() {
    const requirements = {
      os: false,
      distribution: false,
      sudo: false,
      internet: false,
      diskSpace: false
    };

    // Check OS
    const os = await this.systemDetector.detectOS();
    requirements.os = os === 'linux';
    if (!requirements.os) {
      throw new Error('This script requires a Linux operating system');
    }

    // Check distribution
    const distribution = await this.systemDetector.detectDistribution();
    requirements.distribution = distribution === 'ubuntu';
    if (!requirements.distribution) {
      this.logger.warning(`This script is optimized for Ubuntu. You're running ${distribution}.`);
    }

    // Check sudo access
    try {
      const result = await this.commandRunner.runSudo('true');
      requirements.sudo = result.success;
    } catch (error) {
      throw new Error('This script requires sudo privileges');
    }

    // Check internet connectivity
    try {
      const result = await this.commandRunner.run('curl', ['-s', '--connect-timeout', '5', 'https://httpbin.org/get']);
      requirements.internet = result.success;
    } catch (error) {
      throw new Error('Internet connectivity is required for package installation');
    }

    // Check disk space (at least 1GB free)
    try {
      const result = await this.commandRunner.run('df', ['/', '--output=avail']);
      const lines = result.stdout.split('\n');
      const availableKB = parseInt(lines[1]);
      requirements.diskSpace = availableKB > 1000000; // 1GB in KB
      
      if (!requirements.diskSpace) {
        this.logger.warning('Low disk space detected. Some installations may fail.');
      }
    } catch (error) {
      this.logger.warning('Could not check disk space');
    }

    return requirements;
  }

  async validatePackageInstallation(packageName) {
    // Check if package is available in repositories
    try {
      const result = await this.commandRunner.run('apt-cache', ['search', packageName]);
      if (!result.success || !result.stdout.includes(packageName)) {
        return { available: false, error: 'Package not found in repositories' };
      }
    } catch (error) {
      return { available: false, error: 'Could not check package availability' };
    }

    // Check if already installed
    const isInstalled = await this.systemDetector.checkPackageInstalled(packageName);
    if (isInstalled) {
      return { available: true, installed: true, message: 'Package already installed' };
    }

    return { available: true, installed: false };
  }

  async validateConfigurationFile(filePath, required = false) {
    try {
      const exists = await fs.pathExists(filePath);
      if (!exists && required) {
        return { valid: false, error: `Required file not found: ${filePath}` };
      }
      
      if (exists) {
        const stats = await fs.stat(filePath);
        const isReadable = await fs.access(filePath, fs.constants.R_OK).then(() => true).catch(() => false);
        const isWritable = await fs.access(filePath, fs.constants.W_OK).then(() => true).catch(() => false);
        
        return {
          valid: true,
          exists: true,
          readable: isReadable,
          writable: isWritable,
          size: stats.size,
          modified: stats.mtime
        };
      }
      
      return { valid: true, exists: false };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  async validateDirectory(dirPath, createIfMissing = false) {
    const expandedPath = this.Utils.expandTilde(dirPath);
    try {
      const exists = await fs.pathExists(expandedPath);
      if (!exists) {
        if (createIfMissing) {
          await fs.ensureDir(expandedPath);
          return { valid: true, created: true };
        } else {
          return { valid: false, error: `Directory not found: ${dirPath}` };
        }
      }
      
      const stats = await fs.stat(expandedPath);
      if (!stats.isDirectory()) {
        return { valid: false, error: `Path exists but is not a directory: ${dirPath}` };
      }
      
      const isReadable = await fs.access(expandedPath, fs.constants.R_OK).then(() => true).catch(() => false);
      const isWritable = await fs.access(expandedPath, fs.constants.W_OK).then(() => true).catch(() => false);
      
      return {
        valid: true,
        exists: true,
        readable: isReadable,
        writable: isWritable
      };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  validateCustomizationOptions(options, type) {
    const errors = [];

    switch (type) {
      case 'micro':
        if (options.theme && !['default', 'dark', 'light', 'monokai', 'solarized'].includes(options.theme)) {
          errors.push('Invalid theme selection');
        }
        if (options.tabSize && ![2, 4, 8].includes(options.tabSize)) {
          errors.push('Invalid tab size');
        }
        if (options.features && !Array.isArray(options.features)) {
          errors.push('Features must be an array');
        }
        break;

      case 'zsh':
        if (options.promptStyle && !['simple', 'detailed', 'git', 'minimal'].includes(options.promptStyle)) {
          errors.push('Invalid prompt style');
        }
        if (options.plugins && !Array.isArray(options.plugins)) {
          errors.push('Plugins must be an array');
        }
        if (options.aliases && !Array.isArray(options.aliases)) {
          errors.push('Aliases must be an array');
        }
        break;

      default:
        errors.push('Unknown customization type');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async validateServiceStatus(serviceName) {
    try {
      const result = await this.commandRunner.run('systemctl', ['is-active', serviceName]);
      return {
        valid: true,
        active: result.stdout.trim() === 'active',
        status: result.stdout.trim()
      };
    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  validatePort(port) {
    const portNum = parseInt(port);
    return {
      valid: portNum >= 1 && portNum <= 65535,
      port: portNum
    };
  }

  validateIPAddress(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    
    return {
      valid: ipv4Regex.test(ip) || ipv6Regex.test(ip),
      type: ipv4Regex.test(ip) ? 'ipv4' : ipv6Regex.test(ip) ? 'ipv6' : 'invalid'
    };
  }
} 