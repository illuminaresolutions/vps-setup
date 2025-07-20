import { StateManager, SystemDetector, Logger, CommandRunner, Validator } from '../utils/index.js';
import { MicroConfigGenerator, ZshConfigGenerator } from '../templates/index.js';

export class ConfigPhase {
  constructor() {
    this.stateManager = new StateManager();
    this.systemDetector = new SystemDetector();
    this.logger = new Logger();
    this.commandRunner = new CommandRunner();
    this.validator = new Validator();
    this.microGenerator = new MicroConfigGenerator();
    this.zshGenerator = new ZshConfigGenerator();
  }

  async execute(customizations = {}) {
    this.logger.section('Phase 3: Configuration Setup');
    
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

    // Write new configuration
    if (typeof content === 'object') {
      await this.validator.Utils.fs.writeJson(expandedPath, content, { spaces: 2 });
    } else {
      await this.validator.Utils.fs.writeFile(expandedPath, content, 'utf8');
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

    // Get Micro configuration
    const microConfigFile = '~/.config/micro/settings.json';
    const microValidation = await this.validator.validateConfigurationFile(microConfigFile);
    if (microValidation.exists && microValidation.readable) {
      try {
        const expandedPath = this.validator.Utils.expandTilde(microConfigFile);
        configs.micro = await this.validator.Utils.fs.readJson(expandedPath);
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
        configs.zsh = await this.validator.Utils.fs.readFile(expandedPath, 'utf8');
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