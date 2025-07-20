#!/usr/bin/env node

import { StateManager, SystemDetector, Logger, CommandRunner, Validator, ErrorHandler } from './utils/index.js';
import { ZshPhase } from './phases/phase1-zsh.js';
import { ToolsPhase } from './phases/phase2-tools.js';
import { ConfigPhase } from './phases/phase3-config.js';
import { AdminPhase } from './phases/phase4-admin.js';
import { OptionalPhase } from './phases/phase5-optional.js';

export class VpsSetupOrchestrator {
  constructor() {
    this.logger = new Logger();
    this.stateManager = new StateManager();
    this.systemDetector = new SystemDetector();
    this.commandRunner = new CommandRunner();
    this.validator = new Validator();
    this.errorHandler = new ErrorHandler(this.logger);
    
    // Initialize phases
    this.phases = [
      new ZshPhase(this.logger, this.stateManager, this.systemDetector, this.commandRunner, this.validator),
      new ToolsPhase(this.logger, this.stateManager, this.systemDetector, this.commandRunner, this.validator),
      new ConfigPhase(this.logger, this.stateManager, this.systemDetector, this.commandRunner, this.validator),
      new AdminPhase(this.logger, this.stateManager, this.systemDetector, this.commandRunner, this.validator),
      new OptionalPhase(this.logger, this.stateManager, this.systemDetector, this.commandRunner, this.validator)
    ];

    this.currentPhaseIndex = 0;
    this.errors = [];
    this.warnings = [];
    this.startTime = null;
  }

  async run(options = {}) {
    this.startTime = Date.now();
    
    try {
      this.logger.info('🚀 Starting VPS Setup Script');

      // Enable verbose output for command execution if requested
      if (options.verbose) {
        this.commandRunner.setVerbose(true);
        this.logger.info('Verbose output enabled');
      }
      this.logger.info(`Version: ${this.getVersion()}`);
      
      // Pre-flight checks
      await this.performPreflightChecks();
      
      // Load or initialize state
      await this.initializeState();
      
      // Detect system information
      const systemInfo = await this.systemDetector.detectSystem();
      this.logger.info(`Detected system: ${systemInfo.distribution} ${systemInfo.version}`);
      
      // Run phases
      await this.runPhases(options);
      
      // Generate final report
      await this.generateFinalReport();
      
      this.logger.success('✅ VPS Setup completed successfully!');
      this.logger.info('🔄 Finalizing setup...');
      
      // Ensure all async operations are complete
      await this.stateManager.saveState();
      
      this.logger.info('✅ Setup finalized successfully');
      
    } catch (error) {
      await this.handleCriticalError(error);
      process.exit(1);
    }
  }

  async performPreflightChecks() {
    this.logger.info('🔍 Performing pre-flight checks...');
    
    // Check if running as root (for some operations)
    const isRoot = process.getuid && process.getuid() === 0;
    if (!isRoot) {
      this.logger.warn('⚠️  Not running as root. Some operations may require sudo.');
    }
    
    // Check available disk space with graceful degradation
    await this.errorHandler.withGracefulDegradation(
      async () => {
        const result = await this.commandRunner.run('df', ['-h', '/']);
        if (result.success) {
          const lines = result.stdout.split('\n');
          const diskInfo = lines[1].split(/\s+/);
          this.logger.info(`Available disk space: ${diskInfo[3]}`);
        }
      },
      async () => {
        this.logger.warn('Could not check disk space');
      },
      { operation: 'disk space check' }
    );
    
    // Check internet connectivity with retry
    await this.errorHandler.withRetry(async () => {
      const result = await this.commandRunner.run('ping', ['-c', '1', '8.8.8.8']);
      if (!result.success) {
        throw new Error('Internet connectivity check failed');
      }
      this.logger.info('✅ Internet connectivity confirmed');
    }, 'network', { operation: 'internet connectivity check' });
  }

  async initializeState() {
    try {
      await this.stateManager.loadState();
      this.logger.info('📋 Loaded existing state');
    } catch (error) {
      this.logger.info('📋 Initializing new state');
      await this.stateManager.initializeState();
    }
  }

  async runPhases(options) {
    const totalPhases = this.phases.length;
    
    for (let i = 0; i < totalPhases; i++) {
      const phase = this.phases[i];
      this.currentPhaseIndex = i;
      
      // Phase header and description are handled by each phase for better formatting
      
      try {
        // Check if phase should be skipped
        if (await this.shouldSkipPhase(phase, options)) {
          this.logger.info(`⏭️  Skipping ${phase.getName()} (already completed)`);
          continue;
        }
        
        // Run the phase
        const result = await this.runPhase(phase, options);
        
        if (result.success) {
          this.logger.success(`✅ ${phase.getName()} completed successfully`);
          await this.stateManager.updatePhaseState(phase.getName(), 'completed', result);
        } else {
          this.logger.error(`❌ ${phase.getName()} failed`);
          this.errors.push({
            phase: phase.getName(),
            error: result.error,
            timestamp: new Date().toISOString()
          });
          
          // Check if we should continue or abort
          if (options.continueOnError !== true) {
            throw new Error(`Phase ${phase.getName()} failed: ${result.error.message}`);
          }
        }
        
      } catch (error) {
        this.logger.error(`💥 Critical error in ${phase.getName()}: ${error.message}`);
        this.errors.push({
          phase: phase.getName(),
          error: error,
          timestamp: new Date().toISOString()
        });
        
        if (options.continueOnError !== true) {
          throw error;
        }
      }
    }
  }

  async shouldSkipPhase(phase, options) {
    // Check if phase is already completed
    const phaseState = await this.stateManager.getPhaseState(phase.getName());
    if (phaseState && phaseState.status === 'completed') {
      return true;
    }
    
    // Check if phase is explicitly disabled
    if (options.skipPhases && options.skipPhases.includes(phase.getName())) {
      return true;
    }
    
    // Check if phase is optional and user chose to skip
    if (phase.isOptional() && options.skipOptional === true) {
      return true;
    }
    
    return false;
  }

  async runPhase(phase, options) {
    const startTime = Date.now();
    
    try {
      // Run phase with timeout
      const result = await Promise.race([
        phase.run(options),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Phase timeout')), 300000) // 5 minutes
        )
      ]);
      
      const duration = Date.now() - startTime;
      this.logger.info(`⏱️  Phase completed in ${duration}ms`);
      
      return {
        success: true,
        result,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`⏱️  Phase failed after ${duration}ms`);
      
      return {
        success: false,
        error,
        duration
      };
    }
  }

  async generateFinalReport() {
    const endTime = Date.now();
    const totalDuration = endTime - this.startTime;
    
    this.logger.info('\n📊 Final Report');
    this.logger.info('='.repeat(50));
    this.logger.info(`Total execution time: ${this.formatDuration(totalDuration)}`);
    this.logger.info(`Phases completed: ${this.phases.length - this.errors.length}/${this.phases.length}`);
    
    // Generate error statistics
    const errorReport = this.errorHandler.generateErrorReport();
    if (errorReport.totalErrors > 0) {
      this.logger.error(`\n❌ Error Statistics:`);
      this.logger.error(`Total errors: ${errorReport.totalErrors}`);
      
      Object.entries(errorReport.errorBreakdown).forEach(([category, operations]) => {
        this.logger.error(`  ${category}:`);
        Object.entries(operations).forEach(([operation, count]) => {
          this.logger.error(`    ${operation}: ${count} error(s)`);
        });
      });
      
      if (errorReport.recommendations.length > 0) {
        this.logger.info('\n💡 Recommendations:');
        errorReport.recommendations.forEach((rec, index) => {
          this.logger.info(`  ${index + 1}. ${rec}`);
        });
      }
    }
    
    if (this.errors.length > 0) {
      this.logger.error(`\n🚨 Critical Errors:`);
      this.errors.forEach((error, index) => {
        this.logger.error(`${index + 1}. ${error.phase}: ${error.error.message}`);
      });
    }
    
    if (this.warnings.length > 0) {
      this.logger.warn(`\n⚠️  Warnings: ${this.warnings.length}`);
      this.warnings.forEach((warning, index) => {
        this.logger.warn(`${index + 1}. ${warning}`);
      });
    }
    
    // Save final state
    await this.stateManager.saveState();
  }

  async handleCriticalError(error) {
    this.logger.error('\n💥 Critical Error Occurred');
    this.logger.error('='.repeat(50));
    this.logger.error(`Error: ${error.message}`);
    this.logger.error(`Stack: ${error.stack}`);
    
    // Save error state
    await this.stateManager.updateErrorState(error);
    
    // Provide recovery suggestions
    this.logger.info('\n🔧 Recovery Suggestions:');
    this.logger.info('1. Check the error message above for specific issues');
    this.logger.info('2. Ensure you have proper permissions (sudo if needed)');
    this.logger.info('3. Verify internet connectivity');
    this.logger.info('4. Check available disk space');
    this.logger.info('5. Run with --continue-on-error to skip failed phases');
    
    this.logger.error('\n❌ Setup failed. Please address the issues and try again.');
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  getVersion() {
    // This would typically come from package.json
    return '1.0.0';
  }

  // Utility methods for external use
  async getProgress() {
    const completed = this.phases.filter((_, index) => index < this.currentPhaseIndex).length;
    return {
      current: this.currentPhaseIndex + 1,
      total: this.phases.length,
      completed,
      percentage: Math.round((completed / this.phases.length) * 100)
    };
  }

  async getErrors() {
    return this.errors;
  }

  async getWarnings() {
    return this.warnings;
  }
}

// CLI entry point
async function main() {
  const orchestrator = new VpsSetupOrchestrator();
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const options = parseArguments(args);
  
  try {
    await orchestrator.run(options);
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  }
}

function parseArguments(args) {
  const options = {
    continueOnError: false,
    skipOptional: false,
    skipPhases: [],
    verbose: false
  };
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    switch (arg) {
      case '--continue-on-error':
        options.continueOnError = true;
        break;
      case '--skip-optional':
        options.skipOptional = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--skip-phases':
        if (i + 1 < args.length) {
          options.skipPhases = args[i + 1].split(',');
          i++;
        }
        break;
      case '--help':
      case '-h':
        showHelp();
        process.exit(0);
        break;
    }
  }
  
  return options;
}

function showHelp() {
  console.log(`
VPS Setup Script

Usage: node main.js [options]

Options:
  --continue-on-error    Continue execution even if a phase fails
  --skip-optional        Skip all optional phases
  --skip-phases <list>   Comma-separated list of phases to skip
  --verbose              Enable verbose logging
  --help, -h            Show this help message

Phases:
  1. zsh                 Install and configure Zsh
  2. tools               Install basic tools (Micro, Git, plugins)
  3. config              Generate configuration files
  4. admin               Install admin tools (htop, ncdu, ufw, fail2ban, tmux)
  5. optional            Install optional tools (bat, curl, wget, etc.)

Examples:
  node main.js
  node main.js --continue-on-error
  node main.js --skip-phases admin,optional
  node main.js --skip-optional --verbose
`);
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 