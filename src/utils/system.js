import { execa } from 'execa';
import fs from 'fs-extra';

export class SystemDetector {
  constructor() {
    this.cache = new Map();
  }

  async detectOS() {
    if (this.cache.has('os')) {
      return this.cache.get('os');
    }

    try {
      const platform = process.platform;
      let os = 'unknown';

      if (platform === 'linux') {
        os = 'linux';
      } else if (platform === 'darwin') {
        os = 'macos';
      } else if (platform === 'win32') {
        os = 'windows';
      }

      this.cache.set('os', os);
      return os;
    } catch (error) {
      console.warn('Could not detect OS:', error.message);
      return 'unknown';
    }
  }

  async detectDistribution() {
    if (this.cache.has('distribution')) {
      return this.cache.get('distribution');
    }

    try {
      if (await fs.pathExists('/etc/os-release')) {
        const content = await fs.readFile('/etc/os-release', 'utf8');
        const lines = content.split('\n');
        const distroInfo = {};

        for (const line of lines) {
          const [key, value] = line.split('=');
          if (key && value) {
            distroInfo[key] = value.replace(/"/g, '');
          }
        }

        const distribution = distroInfo.ID || distroInfo.DISTRIB_ID || 'unknown';
        this.cache.set('distribution', distribution);
        return distribution;
      }
    } catch (error) {
      console.warn('Could not detect distribution:', error.message);
    }

    this.cache.set('distribution', 'unknown');
    return 'unknown';
  }

  async detectShell() {
    if (this.cache.has('shell')) {
      return this.cache.get('shell');
    }

    try {
      const shell = process.env.SHELL || 'unknown';
      const shellName = shell.split('/').pop();
      this.cache.set('shell', shellName);
      return shellName;
    } catch (error) {
      console.warn('Could not detect shell:', error.message);
      this.cache.set('shell', 'unknown');
      return 'unknown';
    }
  }

  async isUbuntu() {
    const distribution = await this.detectDistribution();
    return distribution.toLowerCase() === 'ubuntu';
  }

  async isLinux() {
    const os = await this.detectOS();
    return os === 'linux';
  }

  async checkPackageInstalled(packageName) {
    try {
      const { stdout } = await execa('dpkg', ['-l', packageName]);
      return stdout.includes(packageName);
    } catch (error) {
      return false;
    }
  }

  async checkCommandExists(command) {
    try {
      await execa('which', [command]);
      return true;
    } catch (error) {
      return false;
    }
  }

  async checkFileExists(filePath) {
    return await fs.pathExists(filePath);
  }

  async checkServiceStatus(serviceName) {
    try {
      const { stdout } = await execa('systemctl', ['is-active', serviceName]);
      return stdout.trim() === 'active';
    } catch (error) {
      return false;
    }
  }

  async getSystemInfo() {
    const [os, distribution, shell] = await Promise.all([
      this.detectOS(),
      this.detectDistribution(),
      this.detectShell()
    ]);

    return { os, distribution, shell };
  }

  async validateSystem() {
    const os = await this.detectOS();
    const distribution = await this.detectDistribution();

    if (os !== 'linux') {
      throw new Error('This script is designed for Linux systems only');
    }

    if (distribution !== 'ubuntu') {
      console.warn(`This script is optimized for Ubuntu. You're running ${distribution}.`);
    }

    return true;
  }
} 