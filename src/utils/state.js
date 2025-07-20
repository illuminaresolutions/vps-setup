import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATE_FILE = path.join(process.env.HOME || process.env.USERPROFILE, '.vps-setup-state.json');

export class StateManager {
  constructor() {
    this.state = {
      version: '1.0.0',
      lastRun: null,
      phases: {},
      configs: {},
      system: {
        os: null,
        distribution: null,
        shell: null
      }
    };
  }

  async load() {
    try {
      if (await fs.pathExists(STATE_FILE)) {
        const data = await fs.readJson(STATE_FILE);
        this.state = { ...this.state, ...data };
        return true;
      }
    } catch (error) {
      console.warn('Could not load state file:', error.message);
    }
    return false;
  }

  async save() {
    try {
      this.state.lastRun = new Date().toISOString();
      await fs.ensureDir(path.dirname(STATE_FILE));
      await fs.writeJson(STATE_FILE, this.state, { spaces: 2 });
      return true;
    } catch (error) {
      console.error('Could not save state file:', error.message);
      return false;
    }
  }

  setPhaseStatus(phaseName, status) {
    this.state.phases[phaseName] = {
      ...this.state.phases[phaseName],
      ...status,
      lastUpdated: new Date().toISOString()
    };
  }

  getPhaseStatus(phaseName) {
    return this.state.phases[phaseName] || { installed: false, configured: false };
  }

  setConfigStatus(configName, status) {
    this.state.configs[configName] = {
      ...this.state.configs[configName],
      ...status,
      lastUpdated: new Date().toISOString()
    };
  }

  getConfigStatus(configName) {
    return this.state.configs[configName] || { configured: false };
  }

  setSystemInfo(info) {
    this.state.system = { ...this.state.system, ...info };
  }

  getSystemInfo() {
    return this.state.system;
  }

  isFirstRun() {
    return !this.state.lastRun;
  }

  getLastRun() {
    return this.state.lastRun;
  }

  reset() {
    this.state = {
      version: '1.0.0',
      lastRun: null,
      phases: {},
      configs: {},
      system: {
        os: null,
        distribution: null,
        shell: null
      }
    };
  }
} 