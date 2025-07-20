#!/usr/bin/env node

import { VpsSetupOrchestrator } from './src/main.js';

// Simple wrapper to run the orchestrator
const orchestrator = new VpsSetupOrchestrator();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

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
      console.log(`
VPS Setup Script

Usage: node vps-setup.js [options]

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
  node vps-setup.js
  node vps-setup.js --continue-on-error
  node vps-setup.js --skip-phases admin,optional
  node vps-setup.js --skip-optional --verbose
`);
      process.exit(0);
      break;
  }
}

// Run the orchestrator
orchestrator.run(options).catch(error => {
  console.error('Fatal error:', error.message);
  process.exit(1);
}); 