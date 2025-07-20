export class MicroConfigGenerator {
  constructor() {
    this.defaultConfig = {
      autoindent: true,
      autosave: 0,
      colorscheme: "default",
      cursorline: true,
      eofnewline: true,
      ignorecase: false,
      indentchar: " ",
      infobar: true,
      keepautoindent: false,
      linter: true,
      pluginchannels: [
        "https://raw.githubusercontent.com/micro-editor/plugin-channel/master/channel.json"
      ],
      pluginrepos: [],
      savecursor: true,
      savehistory: true,
      saveundo: true,
      scrollbar: true,
      scrollmargin: 3,
      scrollspeed: 2,
      softwrap: true,
      statusline: true,
      syntax: true,
      tabmovement: false,
      tabsize: 4,
      tabstospaces: true,
      termtitle: false,
      backup: true,
      ruler: true,
      diffgutter: true
    };
  }

  generateConfig(customizations = {}) {
    const config = { ...this.defaultConfig };

    // Apply theme customization
    if (customizations.theme) {
      config.colorscheme = customizations.theme;
    }

    // Apply tab size customization
    if (customizations.tabSize) {
      config.tabsize = customizations.tabSize;
    }

    // Apply feature customizations
    if (customizations.features) {
      this.applyFeatureCustomizations(config, customizations.features);
    }

    return config;
  }

  applyFeatureCustomizations(config, features) {
    const featureMap = {
      mouse: { key: 'mouse', value: true },
      softwrap: { key: 'softwrap', value: true },
      syntax: { key: 'syntax', value: true },
      autoindent: { key: 'autoindent', value: true },
      linenumbers: { key: 'linenumbers', value: true },
      statusline: { key: 'statusline', value: true },
      scrollbar: { key: 'scrollbar', value: true }
    };

    // Apply selected features
    for (const feature of features) {
      if (featureMap[feature]) {
        const { key, value } = featureMap[feature];
        config[key] = value;
      }
    }

    // Handle inverse features (features that are enabled by default but can be disabled)
    const inverseFeatures = {
      'no-mouse': { key: 'mouse', value: false },
      'no-softwrap': { key: 'softwrap', value: false },
      'no-syntax': { key: 'syntax', value: false },
      'no-autoindent': { key: 'autoindent', value: false },
      'no-linenumbers': { key: 'linenumbers', value: false },
      'no-statusline': { key: 'statusline', value: false },
      'no-scrollbar': { key: 'scrollbar', value: false }
    };

    for (const feature of features) {
      if (inverseFeatures[feature]) {
        const { key, value } = inverseFeatures[feature];
        config[key] = value;
      }
    }
  }

  getAvailableThemes() {
    return [
      'default',
      'dark',
      'light',
      'monokai',
      'solarized',
      'solarized-tc',
      'solarized-dark',
      'solarized-light',
      'zenburn',
      'gruvbox',
      'dracula',
      'nord',
      'material',
      'one-dark',
      'one-light'
    ];
  }

  getAvailableFeatures() {
    return [
      { name: 'Mouse support', value: 'mouse', description: 'Enable mouse interaction' },
      { name: 'Soft wrap', value: 'softwrap', description: 'Wrap long lines' },
      { name: 'Syntax highlighting', value: 'syntax', description: 'Enable syntax highlighting' },
      { name: 'Auto indent', value: 'autoindent', description: 'Auto-indent new lines' },
      { name: 'Line numbers', value: 'linenumbers', description: 'Show line numbers' },
      { name: 'Status line', value: 'statusline', description: 'Show status line' },
      { name: 'Scroll bar', value: 'scrollbar', description: 'Show scroll bar' },
      { name: 'Ruler', value: 'ruler', description: 'Show column ruler' },
      { name: 'Diff gutter', value: 'diffgutter', description: 'Show diff indicators' },
      { name: 'Linter', value: 'linter', description: 'Enable linter' }
    ];
  }

  validateConfig(config) {
    const errors = [];

    // Validate theme
    const availableThemes = this.getAvailableThemes();
    if (config.colorscheme && !availableThemes.includes(config.colorscheme)) {
      errors.push(`Invalid theme: ${config.colorscheme}`);
    }

    // Validate tab size
    if (config.tabsize && ![2, 4, 8].includes(config.tabsize)) {
      errors.push(`Invalid tab size: ${config.tabsize}`);
    }

    // Validate boolean values
    const booleanKeys = ['mouse', 'softwrap', 'syntax', 'autoindent', 'linenumbers', 'statusline', 'scrollbar'];
    for (const key of booleanKeys) {
      if (config[key] !== undefined && typeof config[key] !== 'boolean') {
        errors.push(`Invalid value for ${key}: must be boolean`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  generateSampleConfig() {
    return this.generateConfig({
      theme: 'dark',
      tabSize: 2,
      features: ['mouse', 'softwrap', 'syntax', 'autoindent', 'linenumbers', 'statusline']
    });
  }

  mergeWithExisting(existingConfig, customizations) {
    const newConfig = this.generateConfig(customizations);
    return { ...existingConfig, ...newConfig };
  }
} 