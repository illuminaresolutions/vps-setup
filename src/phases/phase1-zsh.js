import { StateManager, SystemDetector, Logger, CommandRunner, Validator } from '../utils/index.js';
import fs from 'fs-extra';
import { ZshConfigGenerator } from '../templates/zsh-config.js';

export class ZshPhase {
  constructor(logger, stateManager, systemDetector, commandRunner, validator) {
    this.logger = logger;
    this.stateManager = stateManager;
    this.systemDetector = systemDetector;
    this.commandRunner = commandRunner;
    this.validator = validator;
    this.summary = { installed: [], skipped: [], failed: [] };
  }

  getName() {
    return 'Zsh Setup';
  }

  getDescription() {
    return 'Install and configure Zsh shell with Oh My Zsh and essential plugins';
  }

  isOptional() {
    return false;
  }

  async run(options = {}) {
    return this.execute(options);
  }

  async execute(customizations = {}) {
    // Show highly visible phase header
    this.logger.phaseHeader(1, 5, 'Essential Tools');
    this.logger.info('ℹ Description: Installs Zsh shell, Oh My Zsh, zsh-autosuggestions, zsh-syntax-highlighting, and sets Zsh as the default shell if requested.');
    const inquirer = (await import('inquirer')).default;
    const { proceed } = await inquirer.prompt([
      {
        type: 'list',
        name: 'proceed',
        message: 'Continue? (yes/skip/abort)',
        choices: [
          { name: 'Yes, run this phase', value: 'yes' },
          { name: 'Skip this phase', value: 'skip' },
          { name: 'Abort setup', value: 'abort' }
        ],
        default: 'yes'
      }
    ]);
    if (proceed === 'skip') {
      this.logger.warning('Phase skipped by user.');
      this.stateManager.setPhaseStatus('zsh', { skipped: true });
      return { success: true, skipped: true };
    } else if (proceed === 'abort') {
      this.logger.error('Setup aborted by user.');
      process.exit(1);
    }

    try {
      // Check if Zsh is installed
      const isInstalled = await this.systemDetector.checkCommandExists('zsh');
      let isDefaultShell = false;
      let currentShell = '';
      if (isInstalled) {
        currentShell = await this.getCurrentShell();
        isDefaultShell = currentShell && currentShell.includes('zsh');
      }

      if (isInstalled && isDefaultShell) {
        this.logger.success('Zsh is already installed and set as your default shell.');
        // Check .zshrc presence after confirming shell
        await this.ensureZshrc();
        this.summary.skipped.push('Zsh');
        this.stateManager.setPhaseStatus('zsh', { installed: true });
        return { success: true, skipped: true };
      }

      if (isInstalled && !isDefaultShell) {
        this.logger.warning(`Zsh is installed but your default shell is ${currentShell}.`);
        const { setDefault } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'setDefault',
            message: 'Would you like to set Zsh as your default shell now?',
            default: true
          }
        ]);
        if (setDefault) {
          await this.setAsDefaultShell();
        } else {
          this.logger.info('Zsh will not be set as default. You can do this later with: chsh -s $(which zsh)');
        }
        await this.ensureZshrc();
        this.summary.skipped.push('Zsh');
        this.stateManager.setPhaseStatus('zsh', { installed: true });
        return { success: true, skipped: true };
      }

      // Validate system requirements
      await this.validator.validateSystemRequirements();

      // Install Zsh
      const spinner = this.logger.startSpinner('Installing Zsh...');
      try {
        await this.commandRunner.updatePackageList();
        await this.commandRunner.installPackage('zsh');
        const verification = await this.verifyInstallation();
        if (!verification.success) {
          throw new Error(verification.error);
        }
        this.logger.stopSpinner(true, 'Zsh installed successfully');
        this.summary.installed.push('Zsh');
        this.stateManager.setPhaseStatus('zsh', { installed: true });
        // Set as default shell
        const { setDefault } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'setDefault',
            message: 'Would you like to set Zsh as your default shell now?',
            default: true
          }
        ]);
        if (setDefault) {
          await this.setAsDefaultShell();
        } else {
          this.logger.info('Zsh will not be set as default. You can do this later with: chsh -s $(which zsh)');
        }
        await this.ensureZshrc();
        // Output verification commands and reminder
        this.logger.info('\nVerification commands:');
        this.logger.info('- zsh --version');
        this.logger.info('- [ -d ~/.oh-my-zsh ] && echo "Oh My Zsh installed"');
        this.logger.info('- [ -d ~/.zsh/zsh-autosuggestions ] && echo "zsh-autosuggestions installed"');
        this.logger.info('- [ -d ~/.zsh/zsh-syntax-highlighting ] && echo "zsh-syntax-highlighting installed"');
        this.logger.info('\nSingle-string test:');
        this.logger.info('zsh --version && [ -d ~/.oh-my-zsh ] && [ -d ~/.zsh/zsh-autosuggestions ] && [ -d ~/.zsh/zsh-syntax-highlighting ] && echo "All Zsh components installed"');
        this.logger.info('\n\u001b[33mReminder: After installation, run \u001b[1msource ~/.zshrc\u001b[0m to apply your new shell configuration.');
        this.logger.info('You may need to log out and log back in for the shell change to take effect.');
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

  // Ensures ~/.zshrc exists, creates a minimal one if missing
  async ensureZshrc() {
    try {
      const home = process.env.HOME || process.env.USERPROFILE;
      if (!home) {
        this.logger.warning('Could not determine home directory to check/create ~/.zshrc');
        return;
      }
      const zshrcPath = `${home}/.zshrc`;
      const exists = await fs.pathExists(zshrcPath);
      if (exists) {
        this.logger.success('.zshrc file already present');
        return;
      }
      // Try to use ZshConfigGenerator if available
      let configContent = '';
      try {
        const generator = new ZshConfigGenerator();
        configContent = generator.generateSampleConfig ? generator.generateSampleConfig() : generator.generateConfig();
      } catch (e) {
        configContent = '# Minimal .zshrc\nexport ZSH=\"$HOME/.oh-my-zsh\"\nZSH_THEME=\"robbyrussell\"\nplugins=(git)\nsource $ZSH/oh-my-zsh.sh\n';
      }
      await fs.writeFile(zshrcPath, configContent, { mode: 0o644 });
      this.logger.success('.zshrc file created');
    } catch (err) {
      this.logger.warning(`Could not create ~/.zshrc: ${err.message}`);
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