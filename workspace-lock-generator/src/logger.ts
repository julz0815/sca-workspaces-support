import chalk from 'chalk';

class Logger {
  private verbose: boolean = false;

  setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  info(message: string) {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message: string) {
    console.log(chalk.green('✓'), message);
  }

  warning(message: string) {
    console.log(chalk.yellow('⚠'), message);
  }

  error(message: string) {
    console.error(chalk.red('✖'), message);
  }

  debug(message: string) {
    if (this.verbose) {
      console.log(chalk.gray('⚡'), message);
    }
  }

  workspace(message: string) {
    console.log(chalk.cyan('📦'), message);
  }

  dependency(message: string) {
    console.log(chalk.magenta('🔗'), message);
  }
}

export const logger = new Logger(); 