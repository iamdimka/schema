export default class ValidatorError extends Error {
    constructor(message: string) {
        super(message);
        
        Error.captureStackTrace(this, ValidatorError);
    }
}