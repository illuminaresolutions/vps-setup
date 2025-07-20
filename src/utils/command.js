import { execa } from 'execa';
import { Logger } from './logger.js';
import { ErrorHandler } from './error-handler.js';

export class CommandRunner {
  constructor(verbose = false) {
    this.logger = new Logger();
    this.errorHandler = new ErrorHandler(this.logger);
    this.verbose = verbose;
  }

  setVerbose(value = true) {
    this.verbose = value;
  }

  async run(command, args = [], options = {}) {
    const defaultOptions = {
      stdio: 'pipe',
      timeout: 300000, // 5 minutes
      ...options
    };

    return await this.errorHandler.withRetry(async () => {
      const result = await execa(command, args, defaultOptions);
      const output = {
        success: true,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode
      };
      if (this.verbose && output.stdout) {
        this.logger.info(output.stdout);
      }
      return output;
    }, 'command-execution', {
      operation: `${command} ${args.join(' ')}`,
      command,
      args
    });
  }

  async runWithRetry(command, args = [], options = {}, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const result = await this.run(command, args, options);
      
      if (result.success) {
        return result;
      }

      if (attempt < maxRetries) {
        this.logger.warning(`Command failed (attempt ${attempt}/${maxRetries}): ${command} ${args.join(' ')}`);
        this.logger.info(`Retrying in ${attempt * 2} seconds...`);
        await this.sleep(attempt * 2000);
      }
    }

    throw new Error(`Command failed after ${maxRetries} attempts: ${command} ${args.join(' ')}`);
  }

  async runSudo(command, args = [], options = {}) {
    return this.run('sudo', [command, ...args], options);
  }

  async runSudoWithRetry(command, args = [], options = {}, maxRetries = 3) {
    return this.runWithRetry('sudo', [command, ...args], options, maxRetries);
  }

  async checkCommandExists(command) {
    const result = await this.run('which', [command]);
    return result.success;
  }

  async checkPackageInstalled(packageName) {
    const result = await this.run('dpkg', ['-l', packageName]);
    return result.success && result.stdout.includes(packageName);
  }

  async updatePackageList() {
    this.logger.info('Updating package list...');
    const result = await this.runSudoWithRetry('apt', ['update']);
    if (!result.success) {
      throw new Error('Failed to update package list');
    }
    return result;
  }

  async installPackage(packageName, options = {}) {
    this.logger.info(`Installing ${packageName}...`);
    
    return await this.errorHandler.withRetry(async () => {
      const result = await this.runSudo('apt', ['install', packageName, '-y'], options);
      if (!result.success) {
        throw new Error(`Failed to install ${packageName}: ${result.error}`);
      }
      return result;
    }, 'package-install', {
      operation: `install package ${packageName}`,
      packageName
    });
  }

  async installPackages(packageNames, options = {}) {
    this.logger.info(`Installing packages: ${packageNames.join(', ')}`);
    
    return await this.errorHandler.withRetry(async () => {
      const result = await this.runSudo('apt', ['install', ...packageNames, '-y'], options);
      if (!result.success) {
        throw new Error(`Failed to install packages: ${result.error}`);
      }
      return result;
    }, 'package-install', {
      operation: `install packages ${packageNames.join(', ')}`,
      packageNames
    });
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async validateCommand(command, args = []) {
    const result = await this.run(command, ['--help']);
    return result.success;
  }

  async getCommandVersion(command) {
    try {
      const result = await this.run(command, ['--version']);
      if (result.success) {
        const lines = result.stdout.split('\n');
        return lines[0].trim();
      }
    } catch (error) {
      // Ignore version check errors
    }
    return 'unknown';
  }
} 