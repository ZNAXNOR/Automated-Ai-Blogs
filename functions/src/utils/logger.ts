/**
 * Logger utility for structured logging.
 */
const log = (level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any) => {
    const logObject = {
        level,
        message,
        timestamp: new Date().toISOString(),
        ...(data && { data }),
    };
    console.log(JSON.stringify(logObject));
};

export const logger = {
    info: (message: string, data?: any) => log('INFO', message, data),
    warn: (message: string, data?: any) => log('WARN', message, data),
    error: (message: string, data?: any) => log('ERROR', message, data),
};
