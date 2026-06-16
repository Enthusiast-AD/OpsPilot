import type {User} from '@opspilot/types'

declare global { // Extend Express Request interface to include user property
    namespace Express {  
        interface Request { 
            user?: User;
        }
    }
}

export {}; 
