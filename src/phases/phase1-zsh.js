import { StateManager, SystemDetector, Logger, CommandRunner, Validator } from '../utils/index.js';

export class ZshPhase {
  constructor() {
    this.stateManager = new StateManager();
    this.systemDetector = new SystemDetector();
    this.logger = new Logger();
    this.commandRunner = new CommandRunner();
    this.validator = new Validator();
  }

  async execute(customizations = {}) {
    this.logger.section('Phase 1: Zsh Setup');
    
    try {
      // Check if Zsh is already installed
      const isInstalled = await this.systemDetector.checkCommandExists('zsh');
      if (isInstalled) {
        this.logger.success('Zsh is already installed');
        this.summary.skipped.push('Zsh');
        this.stateManager.setPhaseStatus('zsh', { installed: true });
        return { success: true, skipped: true };
      }

      // Validate system requirements
      await this.validator.validateSystemRequirements();

      // Install Zsh
      const spinner = this.logger.startSpinner('Installing Zsh...');
      
      try {
        // Update package list
        await this.commandRunner.updatePackageList();
        
        // Install Zsh
        await this.commandRunner.installPackage('zsh');
        
        // Verify installation
        const verification = await this.verifyInstallation();
        if (!verification.success) {
          throw new Error(verification.error);
        }

        this.logger.stopSpinner(true, 'Zsh installed successfully');
        this.summary.installed.push('Zsh');
        this.stateManager.setPhaseStatus('zsh', { installed: true });

        // Set Zsh as default shell if requested
        if (customizations.setAsDefault !== false) {
          await this.setAsDefaultShell();
        }

        return { success: true, installed: true };

      } catch (error) {
        this.logger.stopSpinner(false, 'Zsh installation failed');
        throw error;
      }

    } catch (error) {
      this.logger.error(`Zsh phase failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async verifyInstallation() {
    try {
      // Check if zsh command exists
      const exists = await this.systemDetector.checkCommandExists('zsh');
      if (!exists) {
        return { success: false, error: 'Zsh command not found after installation' };
      }

      // Check if zsh can be executed
      const result = await this.commandRunner.run('zsh', ['--version']);
      if (!result.success) {
        return { success: false, error: 'Zsh cannot be executed' };
      }

      // Get version info
      const version = result.stdout.split('\n')[0];
      this.logger.info(`Zsh version: ${version}`);

      return { success: true, version };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async setAsDefaultShell() {
    try {
      this.logger.info('Setting Zsh as default shell...');
      
      // Get current user
      const user = process.env.USER || process.env.LOGNAME;
      if (!user) {
        throw new Error('Could not determine current user');
      }

      // Change default shell
      const result = await this.commandRunner.runSudo('chsh', ['-s', '/usr/bin/zsh', user]);
      if (!result.success) {
        throw new Error('Failed to set Zsh as default shell');
      }

      this.logger.success('Zsh set as default shell');
      this.logger.info('You will need to log out and log back in for the change to take effect');
      
      return true;
    } catch (error) {
      this.logger.warning(`Could not set Zsh as default shell: ${error.message}`);
      this.logger.info('You can manually set it later with: chsh -s $(which zsh)');
      return false;
    }
  }

  async getCurrentShell() {
    try {
      const result = await this.commandRunner.run('echo', ['$SHELL']);
      return result.stdout.trim();
    } catch (error) {
      return null;
    }
  }

  async checkZshPlugins() {
    const plugins = [
      { name: 'zsh-autosuggestions', path: '~/.zsh/zsh-autosuggestions' },
      { name: 'zsh-syntax-highlighting', path: '~/.zsh/zsh-syntax-highlighting' }
    ];

    const installed = [];
    const missing = [];

    for (const plugin of plugins) {
      const exists = await this.systemDetector.checkFileExists(plugin.path);
      if (exists) {
        installed.push(plugin.name);
      } else {
        missing.push(plugin.name);
      }
    }

    return { installed, missing };
  }
} 