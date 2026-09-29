export declare const EMAIL_QUEUE: 'scheduled-emails';
export declare const EMAIL_JOB: 'send-email';
export type EmailJobData = { emailId: string };
export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';
