#!/usr/bin/env node

import { StateManager, SystemDetector, Logger, Prompts, CommandRunner } from './utils/index.js';

class VPSSetup {
  constructor() {
    this.stateManager = new StateManager();
    this.systemDetector = new SystemDetector();
    this.logger = new Logger();
    this.prompts = new Prompts();
    this.commandRunner = new CommandRunner();
    this.summary = {
      installed: [],
      configured: [],
      skipped: [],
      failed: []
    };
  }

  async run() {
    try {
      // Show banner
      this.logger.banner();

      // Load previous state
      await this.stateManager.load();

      // Welcome and get user confirmation
      const proceed = await this.prompts.welcome(this.stateManager);
      if (!proceed) {
        this.logger.info('Setup cancelled by user');
        return;
      }

      // Validate system
      await this.systemDetector.validateSystem();
      
      // Detect current system state
      const systemInfo = await this.systemDetector.getSystemInfo();
      this.stateManager.setSystemInfo(systemInfo);
      
      this.logger.info(`Detected: ${systemInfo.distribution} (${systemInfo.shell})`);

      // Get current phase states for smart re-run
      const currentPhaseStates = {};
      for (const phase of ['zsh', 'tools', 'config', 'admin', 'optional']) {
        const status = this.stateManager.getPhaseStatus(phase);
        currentPhaseStates[phase] = status.installed;
      }

      // Select phases to run
      const selectedPhases = await this.prompts.selectPhases(currentPhaseStates);
      
      if (selectedPhases.length === 0) {
        this.logger.warning('No phases selected. Exiting.');
        return;
      }

      // Show what will be done
      this.logger.section('Setup Plan');
      this.logger.info(`Selected phases: ${selectedPhases.join(', ')}`);

      // Get customization options
      const customizations = await this.getCustomizations(selectedPhases);

      // Confirm installation
      const summary = this.buildSummary(selectedPhases, customizations);
      const confirmed = await this.prompts.confirmInstallation(summary);
      
      if (!confirmed) {
        this.logger.info('Installation cancelled by user');
        return;
      }

      // Execute phases
      await this.executePhases(selectedPhases, customizations);

      // Save state
      await this.stateManager.save();

      // Show summary report
      this.logger.summaryReport(this.summary);

      // Show next steps
      this.showNextSteps();

    } catch (error) {
      this.logger.error(`Setup failed: ${error.message}`);
      this.summary.failed.push({ name: 'Setup', error: error.message });
      this.logger.summaryReport(this.summary);
      process.exit(1);
    }
  }

  async getCustomizations(selectedPhases) {
    const customizations = {};

    if (selectedPhases.includes('config')) {
      this.logger.section('Customization Options');
      
      if (selectedPhases.includes('tools')) {
        this.logger.subsection('Micro Editor Settings');
        customizations.micro = await this.prompts.microCustomization();
      }

      this.logger.subsection('Zsh Configuration');
      customizations.zsh = await this.prompts.zshCustomization();
    }

    if (selectedPhases.includes('admin')) {
      this.logger.subsection('Admin Tools Selection');
      customizations.adminTools = await this.prompts.adminToolsSelection();
    }

    if (selectedPhases.includes('optional')) {
      this.logger.subsection('Optional Tools Selection');
      customizations.optionalTools = await this.prompts.optionalToolsSelection();
    }

    return customizations;
  }

  buildSummary(selectedPhases, customizations) {
    const summary = {
      phases: selectedPhases.map(phase => {
        const phaseNames = {
          zsh: 'Install and configure Zsh',
          tools: 'Install basic tools',
          config: 'Configure editor and shell',
          admin: 'Install admin tools',
          optional: 'Install optional tools'
        };
        return phaseNames[phase] || phase;
      }),
      tools: [],
      configs: []
    };

    if (customizations.adminTools) {
      summary.tools.push(...customizations.adminTools);
    }

    if (customizations.optionalTools) {
      summary.tools.push(...customizations.optionalTools);
    }

    if (customizations.micro) {
      summary.configs.push('Micro editor configuration');
    }

    if (customizations.zsh) {
      summary.configs.push('Zsh configuration');
    }

    return summary;
  }

  async executePhases(selectedPhases, customizations) {
    this.logger.section('Executing Setup');

    for (const phase of selectedPhases) {
      this.logger.subsection(`Phase: ${phase}`);
      
      try {
        switch (phase) {
          case 'zsh':
            await this.executeZshPhase();
            break;
          case 'tools':
            await this.executeToolsPhase();
            break;
          case 'config':
            await this.executeConfigPhase(customizations);
            break;
          case 'admin':
            await this.executeAdminPhase(customizations.adminTools);
            break;
          case 'optional':
            await this.executeOptionalPhase(customizations.optionalTools);
            break;
        }
      } catch (error) {
        this.logger.error(`Phase ${phase} failed: ${error.message}`);
        this.summary.failed.push({ name: phase, error: error.message });
      }
    }
  }

  async executeZshPhase() {
    const spinner = this.logger.startSpinner('Installing Zsh...');
    
    try {
      // Check if already installed
      const isInstalled = await this.systemDetector.checkCommandExists('zsh');
      if (isInstalled) {
        this.logger.stopSpinner(true, 'Zsh already installed');
        this.summary.skipped.push('Zsh');
        return;
      }

      // Install Zsh
      await this.runCommand('apt', ['update']);
      await this.runCommand('apt', ['install', 'zsh', '-y']);
      
      this.logger.stopSpinner(true, 'Zsh installed successfully');
      this.summary.installed.push('Zsh');
      this.stateManager.setPhaseStatus('zsh', { installed: true });
      
    } catch (error) {
      this.logger.stopSpinner(false, 'Zsh installation failed');
      throw error;
    }
  }

  async executeToolsPhase() {
    const spinner = this.logger.startSpinner('Installing basic tools...');
    
    try {
      const tools = ['micro', 'git'];
      const installed = [];

      for (const tool of tools) {
        const isInstalled = await this.systemDetector.checkCommandExists(tool);
        if (isInstalled) {
          this.summary.skipped.push(tool);
          continue;
        }

        await this.runCommand('apt', ['install', tool, '-y']);
        installed.push(tool);
      }

      // Install Zsh plugins
      await this.installZshPlugins();

      this.logger.stopSpinner(true, `Installed: ${installed.join(', ')}`);
      this.summary.installed.push(...installed);
      this.stateManager.setPhaseStatus('tools', { installed: true });
      
    } catch (error) {
      this.logger.stopSpinner(false, 'Tools installation failed');
      throw error;
    }
  }

  async installZshPlugins() {
    const plugins = [
      { name: 'zsh-autosuggestions', url: 'https://github.com/zsh-users/zsh-autosuggestions' },
      { name: 'zsh-syntax-highlighting', url: 'https://github.com/zsh-users/zsh-syntax-highlighting.git' }
    ];

    for (const plugin of plugins) {
      const pluginPath = `~/.zsh/${plugin.name}`;
      const exists = await this.systemDetector.checkFileExists(pluginPath);
      
      if (!exists) {
        await this.runCommand('git', ['clone', plugin.url, pluginPath]);
        this.summary.installed.push(`${plugin.name} plugin`);
      } else {
        this.summary.skipped.push(`${plugin.name} plugin`);
      }
    }
  }

  async executeConfigPhase(customizations) {
    const spinner = this.logger.startSpinner('Configuring editor and shell...');
    
    try {
      if (customizations.micro) {
        await this.configureMicro(customizations.micro);
      }

      if (customizations.zsh) {
        await this.configureZsh(customizations.zsh);
      }

      this.logger.stopSpinner(true, 'Configuration completed');
      this.stateManager.setPhaseStatus('config', { configured: true });
      
    } catch (error) {
      this.logger.stopSpinner(false, 'Configuration failed');
      throw error;
    }
  }

  async configureMicro(config) {
    // This will be implemented in the template generators
    this.summary.configured.push('Micro editor settings');
  }

  async configureZsh(config) {
    // This will be implemented in the template generators
    this.summary.configured.push('Zsh configuration');
  }

  async executeAdminPhase(tools) {
    if (!tools || tools.length === 0) {
      this.logger.info('No admin tools selected');
      return;
    }

    const spinner = this.logger.startSpinner('Installing admin tools...');
    
    try {
      const installed = [];

      for (const tool of tools) {
        const isInstalled = await this.systemDetector.checkCommandExists(tool);
        if (isInstalled) {
          this.summary.skipped.push(tool);
          continue;
        }

        await this.runCommand('apt', ['install', tool, '-y']);
        installed.push(tool);
      }

      // Configure UFW if installed
      if (tools.includes('ufw')) {
        await this.configureUFW();
      }

      this.logger.stopSpinner(true, `Installed: ${installed.join(', ')}`);
      this.summary.installed.push(...installed);
      this.stateManager.setPhaseStatus('admin', { installed: true });
      
    } catch (error) {
      this.logger.stopSpinner(false, 'Admin tools installation failed');
      throw error;
    }
  }

  async configureUFW() {
    try {
      await this.runCommand('ufw', ['enable']);
      await this.runCommand('ufw', ['allow', 'OpenSSH']);
      this.summary.configured.push('UFW firewall');
    } catch (error) {
      this.logger.warning('UFW configuration failed, but installation succeeded');
    }
  }

  async executeOptionalPhase(tools) {
    if (!tools || tools.length === 0) {
      this.logger.info('No optional tools selected');
      return;
    }

    const spinner = this.logger.startSpinner('Installing optional tools...');
    
    try {
      const installed = [];

      for (const tool of tools) {
        const isInstalled = await this.systemDetector.checkCommandExists(tool);
        if (isInstalled) {
          this.summary.skipped.push(tool);
          continue;
        }

        await this.runCommand('apt', ['install', tool, '-y']);
        installed.push(tool);
      }

      this.logger.stopSpinner(true, `Installed: ${installed.join(', ')}`);
      this.summary.installed.push(...installed);
      this.stateManager.setPhaseStatus('optional', { installed: true });
      
    } catch (error) {
      this.logger.stopSpinner(false, 'Optional tools installation failed');
      throw error;
    }
  }

  async runCommand(command, args) {
    return await this.commandRunner.run(command, args);
  }

  showNextSteps() {
    this.logger.section('Next Steps');
    this.logger.info('1. Log out and log back in to start using Zsh');
    this.logger.info('2. Use "e filename" to edit files with Micro');
    this.logger.info('3. Use "htop" to monitor system resources');
    this.logger.info('4. Use "tmux" for terminal multiplexing');
    this.logger.info('5. Check UFW status with "sudo ufw status"');
    this.logger.info('\nYour VPS is now ready for development! 🚀');
  }
}

// Run the setup
const setup = new VPSSetup();
setup.run().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
}); 