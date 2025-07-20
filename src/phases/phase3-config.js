import { StateManager, SystemDetector, Logger, CommandRunner, Validator } from '../utils/index.js';
import { MicroConfigGenerator, ZshConfigGenerator } from '../templates/index.js';

export class ConfigPhase {
  constructor(logger, stateManager, systemDetector, commandRunner, validator) {
    this.logger = logger;
    this.stateManager = stateManager;
    this.systemDetector = systemDetector;
    this.commandRunner = commandRunner;
    this.validator = validator;
    this.microGenerator = new MicroConfigGenerator();
    this.zshGenerator = new ZshConfigGenerator();
  }

  getName() {
    return 'Configuration';
  }

  getDescription() {
    return 'Generate and apply configuration files for Micro editor and Zsh';
  }

  isOptional() {
    return false;
  }

  async run(options = {}) {
    return this.execute(options);
  }

  async execute(customizations = {}) {
    // Show highly visible phase header
    this.logger.phaseHeader(3, 5, 'Configuration');
    this.logger.info('ℹ Description: Generates and applies configuration files for Micro editor and Zsh, customizing settings and themes.');
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
      this.stateManager.setPhaseStatus('config', { skipped: true });
      return { success: true, skipped: true };
    } else if (proceed === 'abort') {
      this.logger.error('Setup aborted by user.');
      process.exit(1);
    }

    
    const results = {
      micro: { success: false, configured: false },
      zsh: { success: false, configured: false }
    };

    try {
      // Configure Micro editor if requested
      if (customizations.micro) {
        results.micro = await this.configureMicro(customizations.micro);
      }

      // Configure Zsh if requested
      if (customizations.zsh) {
        results.zsh = await this.configureZsh(customizations.zsh);
      }

      // Update state
      this.stateManager.setPhaseStatus('config', { configured: true });

      // Output verification commands
      this.logger.info('\nVerification commands:');
      this.logger.info('- [ -f ~/.config/micro/settings.json ] && echo "Micro config present"');
      this.logger.info('- [ -f ~/.zshrc ] && echo ".zshrc present"');
      this.logger.info('\nSingle-string test:');
      this.logger.info('[ -f ~/.config/micro/settings.json ] && [ -f ~/.zshrc ] && echo "All config files present"');
      this.logger.info('\n\u001b[33mReminder: After changing your Zsh configuration, run \u001b[1msource ~/.zshrc\u001b[0m to apply your new shell configuration.');
      return { success: true, results };

    } catch (error) {
      this.logger.error(`Configuration phase failed: ${error.message}`);
      return { success: false, error: error.message, results };
    }
  }

  async configureMicro(config) {
    this.logger.subsection('Configuring Micro Editor');

    try {
      // Validate customization options
      const validation = this.validator.validateCustomizationOptions(config, 'micro');
      if (!validation.valid) {
        throw new Error(`Invalid Micro configuration: ${validation.errors.join(', ')}`);
      }

      // Check if Micro is installed
      const isInstalled = await this.systemDetector.checkCommandExists('micro');
      if (!isInstalled) {
        throw new Error('Micro editor is not installed. Please run the tools phase first.');
      }

      // Create config directory
      const configDir = '~/.config/micro';
      await this.validator.validateDirectory(configDir, true);

      // Generate configuration
      const settings = this.microGenerator.generateConfig(config);
      
      // Write configuration file
      const settingsFile = `${configDir}/settings.json`;
      await this.writeConfigurationFile(settingsFile, settings);

      this.logger.success('Micro editor configured successfully');
      return { success: true, configured: true, file: settingsFile };

    } catch (error) {
      this.logger.error(`Micro configuration failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async configureZsh(config) {
    this.logger.subsection('Configuring Zsh');

    try {
      // Validate customization options
      const validation = this.validator.validateCustomizationOptions(config, 'zsh');
      if (!validation.valid) {
        throw new Error(`Invalid Zsh configuration: ${validation.errors.join(', ')}`);
      }

      // Check if Zsh is installed
      const isInstalled = await this.systemDetector.checkCommandExists('zsh');
      if (!isInstalled) {
        throw new Error('Zsh is not installed. Please run the Zsh phase first.');
      }

      // Get system information for conditional logic
      const systemInfo = await this.systemDetector.getSystemInfo();
      
      // Generate configuration
      const zshrc = this.zshGenerator.generateConfig(config, systemInfo);
      
      // Write configuration file
      const zshrcFile = '~/.zshrc';
      await this.writeConfigurationFile(zshrcFile, zshrc);

      this.logger.success('Zsh configured successfully');
      return { success: true, configured: true, file: zshrcFile };

    } catch (error) {
      this.logger.error(`Zsh configuration failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  async writeConfigurationFile(filePath, content) {
    const expandedPath = this.validator.Utils.expandTilde(filePath);
    
    // Backup existing file if it exists
    const backupPath = await this.validator.Utils.backupFile(filePath);
    if (backupPath) {
      this.logger.info(`Backed up existing configuration to: ${backupPath}`);
    }

    // Write new configuration using fs-extra
    const fs = await import('fs-extra');
    if (typeof content === 'object') {
      await fs.writeJson(expandedPath, content, { spaces: 2 });
    } else {
      await fs.writeFile(expandedPath, content, 'utf8');
    }

    this.logger.info(`Configuration written to: ${expandedPath}`);
  }

  async validateConfigurations() {
    const validations = {};

    // Validate Micro configuration
    const microConfigFile = '~/.config/micro/settings.json';
    validations.micro = await this.validator.validateConfigurationFile(microConfigFile);

    // Validate Zsh configuration
    const zshrcFile = '~/.zshrc';
    validations.zsh = await this.validator.validateConfigurationFile(zshrcFile);

    return validations;
  }

  async getCurrentConfigurations() {
    const configs = {};
    const fs = await import('fs-extra');

    // Get Micro configuration
    const microConfigFile = '~/.config/micro/settings.json';
    const microValidation = await this.validator.validateConfigurationFile(microConfigFile);
    if (microValidation.exists && microValidation.readable) {
      try {
        const expandedPath = this.validator.Utils.expandTilde(microConfigFile);
        configs.micro = await fs.readJson(expandedPath);
      } catch (error) {
        configs.micro = { error: 'Could not read Micro configuration' };
      }
    }

    // Get Zsh configuration
    const zshrcFile = '~/.zshrc';
    const zshValidation = await this.validator.validateConfigurationFile(zshrcFile);
    if (zshValidation.exists && zshValidation.readable) {
      try {
        const expandedPath = this.validator.Utils.expandTilde(zshrcFile);
        configs.zsh = await fs.readFile(expandedPath, 'utf8');
      } catch (error) {
        configs.zsh = { error: 'Could not read Zsh configuration' };
      }
    }

    return configs;
  }

  async testConfigurations() {
    const tests = {};

    // Test Micro configuration
    try {
      const microResult = await this.commandRunner.run('micro', ['--version']);
      tests.micro = { success: microResult.success, version: microResult.stdout.trim() };
    } catch (error) {
      tests.micro = { success: false, error: error.message };
    }

    // Test Zsh configuration
    try {
      const zshResult = await this.commandRunner.run('zsh', ['-c', 'echo "Zsh test successful"']);
      tests.zsh = { success: zshResult.success, output: zshResult.stdout.trim() };
    } catch (error) {
      tests.zsh = { success: false, error: error.message };
    }

    return tests;
  }
} 