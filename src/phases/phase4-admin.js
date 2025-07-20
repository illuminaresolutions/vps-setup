import { StateManager, SystemDetector, Logger, CommandRunner, Validator } from '../utils/index.js';

export class AdminPhase {
  constructor(logger, stateManager, systemDetector, commandRunner, validator) {
    this.logger = logger;
    this.stateManager = stateManager;
    this.systemDetector = systemDetector;
    this.commandRunner = commandRunner;
    this.validator = validator;
  }

  getName() {
    return 'Admin Tools';
  }

  getDescription() {
    return 'Install and configure system administration tools';
  }

  isOptional() {
    return false;
  }

  async run(options = {}) {
    return this.execute(options);
  }

  async execute(customizations = {}) {
    this.logger.section('Phase 4: Admin Tools Installation');
    
    const results = {
      installed: [],
      skipped: [],
      failed: [],
      configured: []
    };

    try {
      // Get selected tools
      const selectedTools = customizations.tools || [
        'htop', 'ncdu', 'ufw', 'fail2ban', 'tmux'
      ];

      if (selectedTools.length === 0) {
        this.logger.info('No admin tools selected');
        return { success: true, results };
      }

      // Update package list
      await this.commandRunner.updatePackageList();

      // Install selected tools
      await this.installTools(selectedTools, results);

      // Configure tools
      await this.configureTools(selectedTools, results);

      // Update state
      this.stateManager.setPhaseStatus('admin', { installed: true });

      return { success: true, results };

    } catch (error) {
      this.logger.error(`Admin tools phase failed: ${error.message}`);
      return { success: false, error: error.message, results };
    }
  }

  async installTools(tools, results) {
    const toolInfo = {
      htop: { description: 'Process monitor', package: 'htop' },
      ncdu: { description: 'Disk usage analyzer', package: 'ncdu' },
      ufw: { description: 'Firewall', package: 'ufw' },
      fail2ban: { description: 'Intrusion prevention', package: 'fail2ban' },
      tmux: { description: 'Terminal multiplexer', package: 'tmux' },
      logrotate: { description: 'Log management', package: 'logrotate' }
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

  async configureTools(tools, results) {
    for (const tool of tools) {
      try {
        switch (tool) {
          case 'ufw':
            await this.configureUFW(results);
            break;
          case 'fail2ban':
            await this.configureFail2ban(results);
            break;
          case 'tmux':
            await this.configureTmux(results);
            break;
          case 'logrotate':
            await this.configureLogrotate(results);
            break;
        }
      } catch (error) {
        this.logger.warning(`Configuration failed for ${tool}: ${error.message}`);
      }
    }
  }

  async configureUFW(results) {
    try {
      this.logger.subsection('Configuring UFW Firewall');

      // Check if UFW is installed
      const isInstalled = await this.systemDetector.checkCommandExists('ufw');
      if (!isInstalled) {
        this.logger.warning('UFW not installed, skipping configuration');
        return;
      }

      // Check current status
      const statusResult = await this.commandRunner.runSudo('ufw', ['status']);
      const isActive = statusResult.stdout.includes('Status: active');

      if (!isActive) {
        // Enable UFW
        await this.commandRunner.runSudo('ufw', ['--force', 'enable']);
        
        // Allow SSH
        await this.commandRunner.runSudo('ufw', ['allow', 'OpenSSH']);
        
        // Allow SSH port 22
        await this.commandRunner.runSudo('ufw', ['allow', '22']);
        
        this.logger.success('UFW enabled and configured');
        results.configured.push('ufw');
      } else {
        this.logger.info('UFW already active');
        results.skipped.push('ufw-config');
      }

    } catch (error) {
      this.logger.warning(`UFW configuration failed: ${error.message}`);
    }
  }

  async configureFail2ban(results) {
    try {
      this.logger.subsection('Configuring Fail2ban');

      // Check if fail2ban is installed
      const isInstalled = await this.systemDetector.checkCommandExists('fail2ban-client');
      if (!isInstalled) {
        this.logger.warning('Fail2ban not installed, skipping configuration');
        return;
      }

      // Check if service is running
      const serviceStatus = await this.validator.validateServiceStatus('fail2ban');
      
      if (!serviceStatus.active) {
        // Start and enable fail2ban
        await this.commandRunner.runSudo('systemctl', ['enable', 'fail2ban']);
        await this.commandRunner.runSudo('systemctl', ['start', 'fail2ban']);
        
        this.logger.success('Fail2ban enabled and started');
        results.configured.push('fail2ban');
      } else {
        this.logger.info('Fail2ban already running');
        results.skipped.push('fail2ban-config');
      }

    } catch (error) {
      this.logger.warning(`Fail2ban configuration failed: ${error.message}`);
    }
  }

  async configureTmux(results) {
    try {
      this.logger.subsection('Configuring Tmux');

      // Check if tmux is installed
      const isInstalled = await this.systemDetector.checkCommandExists('tmux');
      if (!isInstalled) {
        this.logger.warning('Tmux not installed, skipping configuration');
        return;
      }

      // Create tmux config directory
      const configDir = '~/.config/tmux';
      await this.validator.validateDirectory(configDir, true);

      // Create basic tmux configuration
      const tmuxConfig = `# Tmux configuration
set -g prefix Tab
unbind C-b
bind-key Tab send-prefix

# Enable mouse support
set -g mouse on

# Easier pane switching
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# Better status bar
set -g status-bg black
set -g status-fg green
set -g status-left-length 50
set -g status-right-length 50
`;

      const configFile = `${configDir}/tmux.conf`;
      const expandedPath = this.validator.Utils.expandTilde(configFile);
      
      // Backup existing config
      await this.validator.Utils.backupFile(configFile);
      
      // Write new config
      await this.validator.Utils.fs.writeFile(expandedPath, tmuxConfig, 'utf8');
      
      this.logger.success('Tmux configured successfully');
      results.configured.push('tmux');

    } catch (error) {
      this.logger.warning(`Tmux configuration failed: ${error.message}`);
    }
  }

  async configureLogrotate(results) {
    try {
      this.logger.subsection('Configuring Logrotate');

      // Check if logrotate is installed
      const isInstalled = await this.systemDetector.checkCommandExists('logrotate');
      if (!isInstalled) {
        this.logger.warning('Logrotate not installed, skipping configuration');
        return;
      }

      // Logrotate is usually pre-configured on Ubuntu
      this.logger.info('Logrotate is pre-configured on Ubuntu');
      results.skipped.push('logrotate-config');

    } catch (error) {
      this.logger.warning(`Logrotate configuration failed: ${error.message}`);
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

  async getToolStatus() {
    const tools = ['htop', 'ncdu', 'ufw', 'fail2ban', 'tmux', 'logrotate'];
    const status = {};

    for (const tool of tools) {
      const exists = await this.systemDetector.checkCommandExists(tool);
      status[tool] = exists;
    }

    return status;
  }

  async getServiceStatus() {
    const services = ['ufw', 'fail2ban'];
    const status = {};

    for (const service of services) {
      const serviceStatus = await this.validator.validateServiceStatus(service);
      status[service] = serviceStatus;
    }

    return status;
  }
} 