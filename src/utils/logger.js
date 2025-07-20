import chalk from 'chalk';
import ora from 'ora';
import boxen from 'boxen';
import figlet from 'figlet';

export class Logger {
  constructor() {
    this.spinner = null;
  }

  // Basic colored output
  info(message) {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message) {
    console.log(chalk.green('✅'), message);
  }

  warning(message) {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message) {
    console.log(chalk.red('❌'), message);
  }

  // Spinner management
  startSpinner(text) {
    this.spinner = ora(text).start();
    return this.spinner;
  }

  stopSpinner(success = true, text = '') {
    if (this.spinner) {
      if (success) {
        this.spinner.succeed(text);
      } else {
        this.spinner.fail(text);
      }
      this.spinner = null;
    }
  }

  updateSpinner(text) {
    if (this.spinner) {
      this.spinner.text = text;
    }
  }

  // Formatted sections
  section(title) {
    console.log('\n' + chalk.cyan.bold(`📋 ${title}`));
    console.log(chalk.gray('─'.repeat(50)));
  }

  subsection(title) {
    console.log(chalk.blue.bold(`  ${title}`));
  }

  // Banner and welcome
  banner() {
    const banner = figlet.textSync('VPS Setup', {
      font: 'Standard',
      horizontalLayout: 'default',
      verticalLayout: 'default'
    });

    const boxedBanner = boxen(banner, {
      padding: 1,
      margin: 1,
      borderStyle: 'round',
      borderColor: 'cyan'
    });

    console.log(boxedBanner);
    console.log(chalk.cyan.bold('Interactive VPS Provisioning with Smart Re-run Capabilities\n'));
  }

  // Progress tracking
  progress(current, total, description = '') {
    const percentage = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.floor(percentage / 2)) + '░'.repeat(50 - Math.floor(percentage / 2));
    
    console.log(chalk.blue(`[${bar}] ${percentage}% ${description}`));
  }

  // Status messages
  status(message, type = 'info') {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = chalk.gray(`[${timestamp}]`);
    
    switch (type) {
      case 'success':
        console.log(`${prefix} ${chalk.green(message)}`);
        break;
      case 'warning':
        console.log(`${prefix} ${chalk.yellow(message)}`);
        break;
      case 'error':
        console.log(`${prefix} ${chalk.red(message)}`);
        break;
      default:
        console.log(`${prefix} ${message}`);
    }
  }

  // Summary report
  summaryReport(data) {
    console.log('\n' + chalk.cyan.bold('📊 Setup Summary Report'));
    console.log(chalk.gray('═'.repeat(60)));

    if (data.installed && data.installed.length > 0) {
      console.log(chalk.green.bold('\n✅ Installed:'));
      data.installed.forEach(item => {
        console.log(chalk.green(`  • ${item}`));
      });
    }

    if (data.configured && data.configured.length > 0) {
      console.log(chalk.blue.bold('\n⚙️  Configured:'));
      data.configured.forEach(item => {
        console.log(chalk.blue(`  • ${item}`));
      });
    }

    if (data.skipped && data.skipped.length > 0) {
      console.log(chalk.yellow.bold('\n⏭️  Skipped (already installed):'));
      data.skipped.forEach(item => {
        console.log(chalk.yellow(`  • ${item}`));
      });
    }

    if (data.failed && data.failed.length > 0) {
      console.log(chalk.red.bold('\n❌ Failed:'));
      data.failed.forEach(item => {
        console.log(chalk.red(`  • ${item.name}: ${item.error}`));
      });
    }

    console.log(chalk.gray('\n' + '═'.repeat(60)));
  }

  // Clear console
  clear() {
    console.clear();
  }
} 