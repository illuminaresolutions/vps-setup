import inquirer from 'inquirer';
import chalk from 'chalk';

export class Prompts {
  constructor() {
    this.choices = {
      phases: [
        { name: 'Phase 1: Install and configure Zsh', value: 'zsh', checked: true },
        { name: 'Phase 2: Install basic tools (Micro editor, Git, plugins)', value: 'tools', checked: true },
        { name: 'Phase 3: Configure editor and shell settings', value: 'config', checked: true },
        { name: 'Phase 4: Install admin tools (htop, ncdu, ufw, fail2ban, tmux)', value: 'admin', checked: true },
        { name: 'Phase 5: Install optional tools (bat, curl, wget, etc.)', value: 'optional', checked: true }
      ],
      microThemes: [
        { name: 'Default', value: 'default' },
        { name: 'Dark', value: 'dark' },
        { name: 'Light', value: 'light' },
        { name: 'Monokai', value: 'monokai' },
        { name: 'Solarized', value: 'solarized' }
      ],
      tabSizes: [
        { name: '2 spaces', value: 2 },
        { name: '4 spaces', value: 4 },
        { name: '8 spaces', value: 8 }
      ],
      promptStyles: [
        { name: 'Simple (user@host:path $)', value: 'simple' },
        { name: 'Detailed with colors', value: 'detailed' },
        { name: 'Git-aware (shows branch)', value: 'git' },
        { name: 'Minimal (just $)', value: 'minimal' }
      ]
    };
  }

  async welcome(stateManager) {
    const isFirstRun = stateManager.isFirstRun();
    const lastRun = stateManager.getLastRun();

    console.log(chalk.cyan.bold('\n🚀 Welcome to VPS Setup!\n'));

    if (isFirstRun) {
      console.log(chalk.green('This appears to be your first time running the setup script.'));
      console.log(chalk.gray('I\'ll help you configure your VPS with all the essential tools and settings.\n'));
    } else {
      console.log(chalk.blue(`Welcome back! Last run: ${new Date(lastRun).toLocaleString()}`));
      console.log(chalk.gray('I\'ll check what\'s already installed and only configure what\'s missing.\n'));
    }

    const { proceed } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'proceed',
        message: 'Ready to start the setup process?',
        default: true
      }
    ]);

    return proceed;
  }

  async selectPhases(currentState = {}) {
    const choices = this.choices.phases.map(choice => ({
      ...choice,
      checked: currentState[choice.value] || choice.checked
    }));

    const { selectedPhases } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedPhases',
        message: 'Select which phases to run:',
        choices,
        validate: (input) => {
          if (input.length === 0) {
            return 'Please select at least one phase';
          }
          return true;
        }
      }
    ]);

    return selectedPhases;
  }

  async microCustomization() {
    const { theme, tabSize, features } = await inquirer.prompt([
      {
        type: 'list',
        name: 'theme',
        message: 'Choose Micro editor color theme:',
        choices: this.choices.microThemes,
        default: 'default'
      },
      {
        type: 'list',
        name: 'tabSize',
        message: 'Choose tab size:',
        choices: this.choices.tabSizes,
        default: 4
      },
      {
        type: 'checkbox',
        name: 'features',
        message: 'Select Micro editor features:',
        choices: [
          { name: 'Mouse support', value: 'mouse', checked: true },
          { name: 'Soft wrap', value: 'softwrap', checked: true },
          { name: 'Syntax highlighting', value: 'syntax', checked: true },
          { name: 'Auto indent', value: 'autoindent', checked: true },
          { name: 'Line numbers', value: 'linenumbers', checked: true },
          { name: 'Status line', value: 'statusline', checked: true },
          { name: 'Scroll bar', value: 'scrollbar', checked: true }
        ]
      }
    ]);

    return { theme, tabSize, features };
  }

  async zshCustomization() {
    const { promptStyle, plugins, aliases } = await inquirer.prompt([
      {
        type: 'list',
        name: 'promptStyle',
        message: 'Choose Zsh prompt style:',
        choices: this.choices.promptStyles,
        default: 'detailed'
      },
      {
        type: 'checkbox',
        name: 'plugins',
        message: 'Select Zsh plugins:',
        choices: [
          { name: 'Autosuggestions (command suggestions)', value: 'autosuggestions', checked: true },
          { name: 'Syntax highlighting', value: 'syntax-highlighting', checked: true },
          { name: 'Git integration', value: 'git', checked: false },
          { name: 'History substring search', value: 'history-substring-search', checked: false }
        ]
      },
      {
        type: 'checkbox',
        name: 'aliases',
        message: 'Select aliases to include:',
        choices: [
          { name: 'e = micro (editor)', value: 'micro', checked: true },
          { name: 'bat = batcat (on Ubuntu)', value: 'bat', checked: true },
          { name: 'll = ls -la', value: 'll', checked: true },
          { name: '.. = cd ..', value: 'cd', checked: false }
        ]
      }
    ]);

    return { promptStyle, plugins, aliases };
  }

  async adminToolsSelection() {
    const { tools } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'tools',
        message: 'Select admin tools to install:',
        choices: [
          { name: 'htop (process monitor)', value: 'htop', checked: true },
          { name: 'ncdu (disk usage analyzer)', value: 'ncdu', checked: true },
          { name: 'ufw (firewall)', value: 'ufw', checked: true },
          { name: 'fail2ban (intrusion prevention)', value: 'fail2ban', checked: true },
          { name: 'tmux (terminal multiplexer)', value: 'tmux', checked: true },
          { name: 'logrotate (log management)', value: 'logrotate', checked: false }
        ]
      }
    ]);

    return tools;
  }

  async optionalToolsSelection() {
    const { tools } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'tools',
        message: 'Select optional tools to install:',
        choices: [
          { name: 'bat (better cat with syntax highlighting)', value: 'bat', checked: true },
          { name: 'curl (HTTP client)', value: 'curl', checked: true },
          { name: 'wget (web downloader)', value: 'wget', checked: true },
          { name: 'zip/unzip (archive tools)', value: 'zip', checked: true },
          { name: 'jq (JSON processor)', value: 'jq', checked: false },
          { name: 'tree (directory tree viewer)', value: 'tree', checked: false }
        ]
      }
    ]);

    return tools;
  }

  async confirmInstallation(summary) {
    console.log(chalk.cyan.bold('\n📋 Installation Summary:'));
    console.log(chalk.gray('─'.repeat(50)));

    if (summary.phases) {
      console.log(chalk.blue.bold('\nPhases to run:'));
      summary.phases.forEach(phase => {
        console.log(chalk.blue(`  • ${phase}`));
      });
    }

    if (summary.tools) {
      console.log(chalk.green.bold('\nTools to install:'));
      summary.tools.forEach(tool => {
        console.log(chalk.green(`  • ${tool}`));
      });
    }

    if (summary.configs) {
      console.log(chalk.yellow.bold('\nConfigurations:'));
      summary.configs.forEach(config => {
        console.log(chalk.yellow(`  • ${config}`));
      });
    }

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: '\nProceed with installation?',
        default: true
      }
    ]);

    return confirm;
  }

  async handleError(error, retryFunction) {
    console.log(chalk.red(`\n❌ Error: ${error.message}`));

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Retry', value: 'retry' },
          { name: 'Skip this step', value: 'skip' },
          { name: 'Exit setup', value: 'exit' }
        ]
      }
    ]);

    switch (action) {
      case 'retry':
        return await retryFunction();
      case 'skip':
        return { skipped: true };
      case 'exit':
        process.exit(1);
    }
  }
} 