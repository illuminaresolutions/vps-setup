import { StateManager, SystemDetector, Logger, CommandRunner, Validator } from '../utils/index.js';

export class ToolsPhase {
  constructor(logger, stateManager, systemDetector, commandRunner, validator) {
    this.logger = logger;
    this.stateManager = stateManager;
    this.systemDetector = systemDetector;
    this.commandRunner = commandRunner;
    this.validator = validator;
  }

  getName() {
    return 'Essential Tools';
  }

  getDescription() {
    return 'Install essential development tools including Micro editor and Git';
  }

  isOptional() {
    return false;
  }

  async run(options = {}) {
    return this.execute(options);
  }

  async execute(customizations = {}) {
    // Show highly visible phase header
    this.logger.phaseHeader(2, 5, 'Essential Tools');
    this.logger.info('ℹ Description: Installs Micro editor (modern terminal text editor), Git (distributed version control), and Zsh plugins (zsh-autosuggestions, zsh-syntax-highlighting).');
    // Prompt user to continue
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
      this.stateManager.setPhaseStatus('tools', { skipped: true });
      return { success: true, skipped: true };
    } else if (proceed === 'abort') {
      this.logger.error('Setup aborted by user.');
      process.exit(1);
    }

    
    const results = {
      installed: [],
      skipped: [],
      failed: [],
      plugins: { installed: [], skipped: [] }
    };

    try {
      // Update package list first
      await this.commandRunner.updatePackageList();

      // Install basic packages
      await this.installBasicPackages(results);

      // Install Zsh plugins
      await this.installZshPlugins(results);

      // Update state
      this.stateManager.setPhaseStatus('tools', { installed: true });

      // Output verification commands
      this.logger.info('\nVerification commands:');
      this.logger.info('- micro --version');
      this.logger.info('- git --version');
      this.logger.info('- [ -d ~/.zsh/zsh-autosuggestions ] && echo "zsh-autosuggestions installed"');
      this.logger.info('- [ -d ~/.zsh/zsh-syntax-highlighting ] && echo "zsh-syntax-highlighting installed"');
      this.logger.info('\nSingle-string test:');
      this.logger.info('micro --version && git --version && [ -d ~/.zsh/zsh-autosuggestions ] && [ -d ~/.zsh/zsh-syntax-highlighting ] && echo "All essential tools installed"');
      return { success: true, results };

    } catch (error) {
      this.logger.error(`Tools phase failed: ${error.message}`);
      return { success: false, error: error.message, results };
    }
  }

  async installBasicPackages(results) {
    const packages = [
      { name: 'micro', description: 'Micro editor' },
      { name: 'git', description: 'Git version control' }
    ];

    for (const pkg of packages) {
      try {
        // Check if already installed
        const isInstalled = await this.systemDetector.checkCommandExists(pkg.name);
        if (isInstalled) {
          this.logger.success(`${pkg.description} already installed`);
          results.skipped.push(pkg.name);
          continue;
        }

        // Validate package availability
        const validation = await this.validator.validatePackageInstallation(pkg.name);
        if (!validation.available) {
          this.logger.warning(`Package ${pkg.name} not available: ${validation.error}`);
          results.failed.push({ name: pkg.name, error: validation.error });
          continue;
        }

        // Install package
        this.logger.info(`Installing ${pkg.description}...`);
        await this.commandRunner.installPackage(pkg.name);

        // Verify installation
        const verification = await this.verifyPackageInstallation(pkg.name);
        if (verification.success) {
          this.logger.success(`${pkg.description} installed successfully`);
          results.installed.push(pkg.name);
        } else {
          this.logger.error(`${pkg.description} installation verification failed`);
          results.failed.push({ name: pkg.name, error: verification.error });
        }

      } catch (error) {
        this.logger.error(`Failed to install ${pkg.description}: ${error.message}`);
        results.failed.push({ name: pkg.name, error: error.message });
      }
    }
  }

  async installZshPlugins(results) {
    this.logger.subsection('Installing Zsh Plugins');

    const plugins = [
      {
        name: 'zsh-autosuggestions',
        url: 'https://github.com/zsh-users/zsh-autosuggestions',
        description: 'Command suggestions'
      },
      {
        name: 'zsh-syntax-highlighting',
        url: 'https://github.com/zsh-users/zsh-syntax-highlighting.git',
        description: 'Syntax highlighting'
      }
    ];

    // Ensure .zsh directory exists
    const zshDir = '~/.zsh';
    await this.validator.validateDirectory(zshDir, true);

    for (const plugin of plugins) {
      try {
        const pluginPath = `${zshDir}/${plugin.name}`;
        
        // Check if plugin already exists
        const exists = await this.systemDetector.checkFileExists(pluginPath);
        if (exists) {
          this.logger.success(`${plugin.description} plugin already installed`);
          results.plugins.skipped.push(plugin.name);
          continue;
        }

        // Clone plugin
        this.logger.info(`Installing ${plugin.description} plugin...`);
        const result = await this.commandRunner.run('git', ['clone', plugin.url, pluginPath]);
        
        if (result.success) {
          this.logger.success(`${plugin.description} plugin installed`);
          results.plugins.installed.push(plugin.name);
        } else {
          this.logger.error(`Failed to install ${plugin.description} plugin`);
          results.failed.push({ name: plugin.name, error: result.error });
        }

      } catch (error) {
        this.logger.error(`Failed to install ${plugin.description} plugin: ${error.message}`);
        results.failed.push({ name: plugin.name, error: error.message });
      }
    }
  }

  async verifyPackageInstallation(packageName) {
    try {
      // Check if command exists
      const exists = await this.systemDetector.checkCommandExists(packageName);
      if (!exists) {
        return { success: false, error: 'Command not found after installation' };
      }

      // Get version info
      const version = await this.commandRunner.getCommandVersion(packageName);
      this.logger.info(`${packageName} version: ${version}`);

      return { success: true, version };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async configureMicro() {
    try {
      this.logger.info('Configuring Micro editor...');
      
      // Create config directory
      const configDir = '~/.config/micro';
      await this.validator.validateDirectory(configDir, true);

      // Check if settings file exists
      const settingsFile = `${configDir}/settings.json`;
      const settingsValidation = await this.validator.validateConfigurationFile(settingsFile);
      
      if (settingsValidation.exists) {
        this.logger.info('Micro settings file already exists');
        return { success: true, exists: true };
      }

      // Create basic settings
      const basicSettings = {
        "mouse": true,
        "softwrap": true,
        "syntax": true,
        "autoindent": true,
        "tabsize": 4,
        "tabstospaces": true
      };

      // This will be replaced by template generator in phase 3
      this.logger.info('Micro configuration will be handled in configuration phase');
      
      return { success: true, exists: false };
    } catch (error) {
      this.logger.warning(`Micro configuration failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async getInstalledPackages() {
    const packages = ['micro', 'git'];
    const installed = [];

    for (const pkg of packages) {
      const exists = await this.systemDetector.checkCommandExists(pkg);
      if (exists) {
        installed.push(pkg);
      }
    }

    return installed;
  }

  async getPluginStatus() {
    const plugins = [
      { name: 'zsh-autosuggestions', path: '~/.zsh/zsh-autosuggestions' },
      { name: 'zsh-syntax-highlighting', path: '~/.zsh/zsh-syntax-highlighting' }
    ];

    const status = {};
    for (const plugin of plugins) {
      const exists = await this.systemDetector.checkFileExists(plugin.path);
      status[plugin.name] = exists;
    }

    return status;
  }
} 