type LogLevel = "debug" | "info" | "warn" | "error";

const isProduction = import.meta.env.PROD;

class Logger {
  private getFormattedTime() {
    return new Date().toISOString();
  }

  public debug(message: string, ...optionalParams: any[]) {
    if (!isProduction) {
      console.log(`[DEBUG][${this.getFormattedTime()}] ${message}`, ...optionalParams);
    }
  }

  public info(message: string, ...optionalParams: any[]) {
    if (!isProduction) {
      console.info(`[INFO][${this.getFormattedTime()}] ${message}`, ...optionalParams);
    }
  }

  public warn(message: string, ...optionalParams: any[]) {
    if (!isProduction) {
      console.warn(`[WARN][${this.getFormattedTime()}] ${message}`, ...optionalParams);
    }
  }

  public error(message: string, ...optionalParams: any[]) {
    // Errors are ALWAYS logged, even in production
    console.error(`[ERROR][${this.getFormattedTime()}] ${message}`, ...optionalParams);
  }
}

export const logger = new Logger();
