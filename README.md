# VPS Setup Script

A comprehensive, interactive VPS provisioning script that transforms a fresh Ubuntu server into a fully configured development environment. Built with Node.js for cross-platform compatibility and smart re-run capabilities.

## 🚀 Features

- **Smart Re-runs**: Resume from where you left off if interrupted
- **Interactive Configuration**: Menu-based customization for tools and settings
- **Comprehensive Error Handling**: Automatic retries and graceful degradation
- **Modular Design**: Five distinct phases for organized setup
- **Cross-Platform**: Works on Ubuntu, Debian, and other Linux distributions
- **State Management**: Tracks progress and prevents duplicate work

## 📋 What Gets Installed

### Phase 1: Zsh Setup
- Zsh shell installation and configuration
- Oh My Zsh framework
- Essential Zsh plugins (autosuggestions, syntax highlighting)
- Custom prompt and aliases

### Phase 2: Essential Tools
- **Micro Editor**: Modern, intuitive text editor
- **Git**: Version control with configuration
- **Essential plugins**: Enhanced terminal experience

### Phase 3: Configuration Generation
- **Micro Editor Settings**: Customized configuration with themes and features
- **Zsh Configuration**: Personalized shell setup
- **Environment Variables**: Proper PATH and editor settings

### Phase 4: Admin Tools
- **htop**: Interactive process viewer
- **ncdu**: Disk usage analyzer
- **ufw**: Uncomplicated firewall
- **fail2ban**: Intrusion prevention
- **tmux**: Terminal multiplexer

### Phase 5: Optional Tools
- **bat**: Better cat with syntax highlighting
- **curl/wget**: File download utilities
- **tree**: Directory tree visualization
- **jq**: JSON processor
- **Additional utilities**: Based on user selection

## 🛠️ Prerequisites

### System Requirements
- **OS**: Ubuntu 20.04+ or Debian 11+
- **Architecture**: x86_64 or ARM64
- **RAM**: Minimum 512MB (1GB recommended)
- **Storage**: At least 2GB free space
- **Network**: Internet connectivity required

### Software Requirements
- **Node.js**: Version 18.0.0 or higher
- **npm**: Usually comes with Node.js
- **sudo access**: Required for package installation

## 📦 Installation

### Quick Start (Recommended)

1. **Install Node.js and nvm with the provided script** (recommended for fresh VPS):
   ```bash
   bash setup_node.sh
   ```
   This script will:
   - Download and install nvm (Node Version Manager)
   - Source nvm for immediate use
   - Install Node.js v22 (latest LTS)
   - Print and verify node and npm versions
   - Pause between steps so you can observe the process

   _You can review or customize the script in `setup_node.sh` before running if desired._

2. **Verify Node.js installation**:
   ```bash
   node --version  # Should show the LTS version
   npm --version   # Should show the corresponding npm version
   nvm current     # Should show the current Node.js version
   ```

3. **Clone the repository**:
   ```bash
   git clone https://github.com/illuminaresolutions/vps-setup.git
   cd vps-setup
   ```

4. **Install dependencies**:
   ```bash
   npm install
   ```

5. **Run the setup script**:
   ```bash
   npm start
   ```

### Alternative: One-Line Installation

For a completely automated setup from a fresh VPS:

```bash
# Install nvm, Node.js, clone repo, and run setup in one command
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash && \
export NVM_DIR="$HOME/.nvm" && \
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
nvm install --lts && \
nvm use --lts && \
git clone https://github.com/illuminaresolutions/vps-setup.git && \
cd vps-setup && \
npm install && \
npm start
```

### Manual Installation (If Node.js is already installed)

If you already have Node.js installed, you can skip to step 3:

1. **Verify Node.js is installed**:
   ```bash
   node --version  # Should be 18.0.0 or higher
   npm --version   # Should be 8.0.0 or higher
   ```

2. **If not installed, install Node.js**:
   ```bash
   # Download and install nvm (Node Version Manager)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

   # Reload shell configuration
   source ~/.bashrc
   # Or if using zsh: source ~/.zshrc

   # Install Node.js LTS version
   nvm install --lts

   # Use the installed version
   nvm use --lts
   ```

3. **Clone and setup**:
   ```bash
   git clone https://github.com/illuminaresolutions/vps-setup.git
   cd vps-setup
   npm install
   ```

## 🎯 Usage

### Basic Usage

Run the script with default settings:
```bash
npm start
```

### Advanced Options

```bash
# Continue even if some phases fail
npm start -- --continue-on-error

# Skip optional phases
npm start -- --skip-optional

# Skip specific phases
npm start -- --skip-phases admin,optional

# Enable verbose logging
npm start -- --verbose

# Show help
npm start -- --help
```

### Direct Node.js Execution

```bash
# Run directly with Node.js
node vps-setup.js

# With options
node vps-setup.js --continue-on-error --skip-optional
```

## 🔧 Configuration

### Interactive Configuration

The script will prompt you for:
- **Micro Editor Theme**: Choose from 15+ themes
- **Tab Size**: 2, 4, or 8 spaces
- **Zsh Prompt Style**: Simple, detailed, git-aware, or minimal
- **Plugin Selection**: Choose which Zsh plugins to install
- **Tool Selection**: Select optional tools to install

### Customization Options

#### Micro Editor Settings
- **Themes**: default, dark, light, monokai, solarized, dracula, nord, and more
- **Features**: mouse support, syntax highlighting, auto-indent, line numbers
- **Tab Configuration**: Size and spaces vs tabs

#### Zsh Configuration
- **Prompt Styles**: Simple, detailed with colors, git-aware, minimal
- **Plugins**: autosuggestions, syntax highlighting, git integration, history search
- **Aliases**: micro, bat, ll, git shortcuts, docker shortcuts

## 📊 Progress Tracking

The script automatically tracks progress and can resume from interruptions:

```bash
# Check current state
cat ~/.vps-setup-state.json

# Reset state to start fresh
rm ~/.vps-setup-state.json
```

### State Management

- **Automatic Detection**: Skips already completed phases
- **Smart Re-runs**: Resume from the last successful phase
- **State Persistence**: Progress saved between sessions
- **Manual Reset**: Clear state file to start over

## 🐛 Troubleshooting

### Common Issues

#### Permission Errors
```bash
# Run with sudo if needed
sudo npm start

# Or ensure proper user permissions
sudo chown -R $USER:$USER ~/.vps-setup-state.json
```

#### Network Issues
```bash
# Check internet connectivity
ping -c 1 8.8.8.8

# Update package lists
sudo apt update
```

#### Node.js Issues
```bash
# Check Node.js version
node --version

# Check nvm installation
nvm --version

# Reinstall if needed
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc  # or source ~/.zshrc
nvm install --lts
nvm use --lts
```

#### Package Installation Failures
```bash
# Update package lists
sudo apt update

# Fix broken packages
sudo apt --fix-broken install

# Clean package cache
sudo apt clean
```

### Error Recovery

The script includes automatic error recovery:

1. **Network Errors**: Automatic retry with exponential backoff
2. **Permission Errors**: Clear guidance on sudo usage
3. **Package Errors**: Automatic package list updates
4. **File System Errors**: Disk space and permission checks

### Debug Mode

Enable verbose logging for detailed troubleshooting:
```bash
npm start -- --verbose
```

## 📁 Project Structure

```
vps-setup/
├── src/
│   ├── phases/           # Setup phases
│   │   ├── phase1-zsh.js
│   │   ├── phase2-tools.js
│   │   ├── phase3-config.js
│   │   ├── phase4-admin.js
│   │   └── phase5-optional.js
│   ├── templates/        # Configuration generators
│   │   ├── micro-config.js
│   │   └── zsh-config.js
│   ├── utils/           # Core utilities
│   │   ├── logger.js
│   │   ├── command.js
│   │   ├── error-handler.js
│   │   └── state.js
│   └── main.js          # Main orchestrator
├── vps-setup.js         # CLI entry point
├── package.json
└── README.md
```

## 🔄 Development

### Local Development

```bash
# Install dependencies
npm install

# Run in development mode (with file watching)
npm run dev

# Run tests (when implemented)
npm test
```

### Adding New Tools

1. **Add to appropriate phase** in `src/phases/`
2. **Update package lists** and installation logic
3. **Add configuration options** if needed
4. **Update documentation**

### Customizing Phases

Each phase is modular and can be customized:
- **Skip phases**: Use `--skip-phases` option
- **Modify phases**: Edit phase files in `src/phases/`
- **Add phases**: Create new phase files and update main orchestrator

## 📈 Performance

### Typical Execution Times

- **Phase 1 (Zsh)**: 2-3 minutes
- **Phase 2 (Tools)**: 3-5 minutes
- **Phase 3 (Config)**: 30 seconds
- **Phase 4 (Admin)**: 2-4 minutes
- **Phase 5 (Optional)**: 1-3 minutes

**Total**: 8-15 minutes depending on system and network

### Optimization Tips

- **Fast network**: Faster package downloads
- **SSD storage**: Faster file operations
- **Adequate RAM**: Prevents swapping during installation
- **Skip optional phases**: Use `--skip-optional` for faster setup

## 🤝 Contributing

### How to Contribute

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/new-tool`
3. **Make your changes**
4. **Test thoroughly**
5. **Submit a pull request**

### Development Guidelines

- **Follow existing patterns**: Use similar structure to existing phases
- **Add error handling**: Use the ErrorHandler for robust operation
- **Update documentation**: Include new features in README
- **Test on fresh VPS**: Ensure it works on clean Ubuntu installations

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Oh My Zsh**: Zsh configuration framework
- **Micro Editor**: Modern terminal editor
- **Node.js Community**: Excellent tooling and packages
- **Ubuntu Community**: Reliable base system

## 📞 Support

### Getting Help

- **Issues**: Create an issue on GitHub
- **Discussions**: Use GitHub Discussions
- **Documentation**: Check this README and inline comments

### Reporting Bugs

When reporting bugs, please include:
- **OS and version**: `lsb_release -a`
- **Node.js version**: `node --version`
- **Error messages**: Full error output
- **Steps to reproduce**: Clear reproduction steps
- **Expected vs actual behavior**: What you expected vs what happened

---

**Happy VPS Setup! 🚀**

Transform your fresh server into a powerful development environment in minutes, not hours. 