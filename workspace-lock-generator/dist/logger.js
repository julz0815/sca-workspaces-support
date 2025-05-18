"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const chalk_1 = __importDefault(require("chalk"));
class Logger {
    constructor() {
        this.verbose = false;
    }
    setVerbose(verbose) {
        this.verbose = verbose;
    }
    info(message) {
        console.log(chalk_1.default.blue('ℹ'), message);
    }
    success(message) {
        console.log(chalk_1.default.green('✓'), message);
    }
    warning(message) {
        console.log(chalk_1.default.yellow('⚠'), message);
    }
    error(message) {
        console.error(chalk_1.default.red('✖'), message);
    }
    debug(message) {
        if (this.verbose) {
            console.log(chalk_1.default.gray('⚡'), message);
        }
    }
    workspace(message) {
        console.log(chalk_1.default.cyan('📦'), message);
    }
    dependency(message) {
        console.log(chalk_1.default.magenta('🔗'), message);
    }
}
exports.logger = new Logger();
