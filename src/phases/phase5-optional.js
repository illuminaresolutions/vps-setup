import { StateManager, SystemDetector, Logger, CommandRunner, Validator } from '../utils/index.js';

export class OptionalPhase {
  constructor(logger, stateManager, systemDetector, commandRunner, validator) {
    this.logger = logger;
    this.stateManager = stateManager;
    this.systemDetector = systemDetector;
    this.commandRunner = commandRunner;
    this.validator = validator;
  }

  getName() {
    return 'Optional Tools';
  }

  getDescription() {
    return 'Install optional development and utility tools';
  }

  isOptional() {
    return true;
  }

  async run(options = {}) {
    return this.execute(options);
  }

  async execute(customizations = {}) {
    // Detailed description
    this.logger.info('ℹ Description: Installs optional development and utility tools: bat (better cat), curl (HTTP client), wget (web downloader), zip/unzip (archive utilities), jq (JSON processor), tree (directory tree viewer).');
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
      this.stateManager.setPhaseStatus('optional', { skipped: true });
      return { success: true, skipped: true };
    } else if (proceed === 'abort') {
      this.logger.error('Setup aborted by user.');
      process.exit(1);
    }

    
    const results = {
      installed: [],
      skipped: [],
      failed: []
    };

    try {
      // Get selected tools
      const selectedTools = customizations.tools || [
        'bat', 'curl', 'wget', 'zip', 'unzip'
      ];

      if (selectedTools.length === 0) {
        this.logger.info('No optional tools selected');
        return { success: true, results };
      }

      // Update package list
      await this.commandRunner.updatePackageList();

      // Install selected tools
      await this.installTools(selectedTools, results);

      // Update state
      this.stateManager.setPhaseStatus('optional', { installed: true });

      // Output verification commands
      this.logger.info('\nVerification commands:');
      this.logger.info('- bat --version || batcat --version');
      this.logger.info('- curl --version');
      this.logger.info('- wget --version');
      this.logger.info('- zip --version');
      this.logger.info('- unzip --version');
      this.logger.info('- jq --version');
      this.logger.info('- tree --version');
      this.logger.info('\nSingle-string test:');
      this.logger.info('(bat --version || batcat --version) && curl --version && wget --version && zip --version && unzip --version && jq --version && tree --version && echo "All optional tools installed"');
      return { success: true, results };

    } catch (error) {
      this.logger.error(`Optional tools phase failed: ${error.message}`);
      return { success: false, error: error.message, results };
    }
  }

  async installTools(tools, results) {
    const toolInfo = {
      bat: { description: 'Better cat with syntax highlighting', package: 'bat' },
      curl: { description: 'HTTP client', package: 'curl' },
      wget: { description: 'Web downloader', package: 'wget' },
      zip: { description: 'Archive compression', package: 'zip' },
      unzip: { description: 'Archive extraction', package: 'unzip' },
      jq: { description: 'JSON processor', package: 'jq' },
      tree: { description: 'Directory tree viewer', package: 'tree' }
    };

    for (const tool of tools) {
      try {
        const info = toolInfo[tool];
        if (!info) {
          this.logger.warning(`Unknown tool: ${tool}`);
          results.failed.push({ name: tool, error: 'Unknown tool' });
          continue;
        }

        // Check if already installed
        const isInstalled = await this.systemDetector.checkCommandExists(tool);
        if (isInstalled) {
          this.logger.success(`${info.description} already installed`);
          results.skipped.push(tool);
          continue;
        }

        // Handle special cases
        if (tool === 'bat') {
          await this.handleBatInstallation(results);
          continue;
        }

        // Install tool
        this.logger.info(`Installing ${info.description}...`);
        await this.commandRunner.installPackage(info.package);

        // Verify installation
        const verification = await this.verifyToolInstallation(tool);
        if (verification.success) {
          this.logger.success(`${info.description} installed successfully`);
          results.installed.push(tool);
        } else {
          this.logger.error(`${info.description} installation verification failed`);
          results.failed.push({ name: tool, error: verification.error });
        }

      } catch (error) {
        this.logger.error(`Failed to install ${tool}: ${error.message}`);
        results.failed.push({ name: tool, error: error.message });
      }
    }
  }

  async handleBatInstallation(results) {
    try {
      this.logger.info('Installing bat (better cat)...');

      // Check if bat is available in repositories
      const validation = await this.validator.validatePackageInstallation('bat');
      if (!validation.available) {
        // Try alternative package name
        const altValidation = await this.validator.validatePackageInstallation('batcat');
        if (altValidation.available) {
          await this.commandRunner.installPackage('batcat');
          
          // Create alias for bat
          await this.createBatAlias();
          
          this.logger.success('batcat installed successfully (aliased as bat)');
          results.installed.push('bat');
        } else {
          throw new Error('bat/batcat not available in repositories');
        }
      } else {
        await this.commandRunner.installPackage('bat');
        this.logger.success('bat installed successfully');
        results.installed.push('bat');
      }

    } catch (error) {
      this.logger.error(`bat installation failed: ${error.message}`);
      results.failed.push({ name: 'bat', error: error.message });
    }
  }

  async createBatAlias() {
    try {
      // Add alias to .bashrc and .zshrc
      const aliasLine = 'alias bat="batcat"';
      const files = ['~/.bashrc', '~/.zshrc'];
      const fs = await import('fs-extra');

      for (const file of files) {
        const expandedPath = this.validator.Utils.expandTilde(file);
        const exists = await fs.pathExists(expandedPath);
        
        if (exists) {
          const content = await fs.readFile(expandedPath, 'utf8');
          if (!content.includes(aliasLine)) {
            await fs.appendFile(expandedPath, `\n${aliasLine}\n`);
            this.logger.info(`Added bat alias to ${file}`);
          }
        }
      }
    } catch (error) {
      this.logger.warning(`Could not create bat alias: ${error.message}`);
    }
  }

  async verifyToolInstallation(tool) {
    try {
      // Check if command exists
      const exists = await this.systemDetector.checkCommandExists(tool);
      if (!exists) {
        return { success: false, error: 'Command not found after installation' };
      }

      // Get version info
      const version = await this.commandRunner.getCommandVersion(tool);
      this.logger.info(`${tool} version: ${version}`);

      return { success: true, version };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testTools() {
    const tests = {};

    // Test curl
    try {
      const curlResult = await this.commandRunner.run('curl', ['--version']);
      tests.curl = { success: curlResult.success, version: curlResult.stdout.split('\n')[0] };
    } catch (error) {
      tests.curl = { success: false, error: error.message };
    }

    // Test wget
    try {
      const wgetResult = await this.commandRunner.run('wget', ['--version']);
      tests.wget = { success: wgetResult.success, version: wgetResult.stdout.split('\n')[0] };
    } catch (error) {
      tests.wget = { success: false, error: error.message };
    }

    // Test bat/batcat
    try {
      const batResult = await this.commandRunner.run('bat', ['--version']);
      tests.bat = { success: batResult.success, version: batResult.stdout.trim() };
    } catch (error) {
      // Try batcat
      try {
        const batcatResult = await this.commandRunner.run('batcat', ['--version']);
        tests.bat = { success: batcatResult.success, version: batcatResult.stdout.trim(), alias: true };
      } catch (error2) {
        tests.bat = { success: false, error: 'Neither bat nor batcat available' };
      }
    }

    // Test jq
    try {
      const jqResult = await this.commandRunner.run('jq', ['--version']);
      tests.jq = { success: jqResult.success, version: jqResult.stdout.trim() };
    } catch (error) {
      tests.jq = { success: false, error: error.message };
    }

    return tests;
  }

  async getInstalledTools() {
    const tools = ['bat', 'curl', 'wget', 'zip', 'unzip', 'jq', 'tree'];
    const installed = [];

    for (const tool of tools) {
      const exists = await this.systemDetector.checkCommandExists(tool);
      if (exists) {
        installed.push(tool);
      } else if (tool === 'bat') {
        // Check for batcat as alternative
        const batcatExists = await this.systemDetector.checkCommandExists('batcat');
        if (batcatExists) {
          installed.push('bat (via batcat)');
        }
      }
    }

    return installed;
  }

  async getToolVersions() {
    const tools = ['bat', 'curl', 'wget', 'zip', 'unzip', 'jq', 'tree'];
    const versions = {};

    for (const tool of tools) {
      try {
        const version = await this.commandRunner.getCommandVersion(tool);
        versions[tool] = version;
      } catch (error) {
        versions[tool] = 'not installed';
      }
    }

    return versions;
  }
} 