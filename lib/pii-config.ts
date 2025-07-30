// PII Redaction Configuration for Banking/Financial Data
// Customize this file to add industry-specific PII patterns

export const bankingPiiPatterns = [
  {
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: '[ACCOUNT_NUMBER]',
    description: 'Philippine bank account number (16 digits)',
  },
  {
    pattern: /\b\d{4}[\s-]?\d{3}[\s-]?\d{3}\b/g,
    replacement: '[PH_MOBILE]',
    description: 'Philippine mobile number format',
  },
  {
    pattern: /\b\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g,
    replacement: '[PH_LANDLINE]',
    description: 'Philippine landline number format',
  },
  {
    pattern: /\b[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{4}\b/g,
    replacement: '[CARD_NUMBER]',
    description: 'Credit/Debit card numbers',
  },
  {
    pattern: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}([A-Z0-9]?){0,16}\b/g,
    replacement: '[IBAN]',
    description: 'International Bank Account Number',
  },
  {
    pattern: /\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b/g,
    replacement: '[SSN]',
    description: 'US Social Security Number',
  },
  {
    pattern: /\b[A-Z0-9]{8,12}\b/g,
    replacement: '[CUSTOMER_ID]',
    description: 'Generic customer/account IDs',
  },
  {
    pattern: /\bBPI-[A-Z0-9]{6,10}\b/g,
    replacement: '[BPI_ACCOUNT]',
    description: 'BPI-specific account identifiers',
  },
  // Common personally identifiable patterns
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL]',
    description: 'Email addresses',
  },
  {
    pattern: /\b(?:\+63|0)[0-9]{10}\b/g,
    replacement: '[PH_PHONE]',
    description: 'Philippine phone numbers',
  },
  // Philippine address patterns
  {
    pattern: /\b\d{4}\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd)\b/gi,
    replacement: '[ADDRESS]',
    description: 'Philippine street addresses',
  },
  {
    pattern: /\b\d{4}(?:\s+Manila|\s+Quezon\s+City|\s+Makati|\s+Cebu|\s+Davao)\b/gi,
    replacement: '[PH_ADDRESS]',
    description: 'Philippine city addresses with postal codes',
  },
];

export const sensitiveKeywords = [
  'password',
  'pwd',
  'secret',
  'token',
  'key',
  'auth',
  'credential',
  'pin',
  'cvv',
  'cvc',
  'security_code',
  'routing_number',
  'swift_code',
  'iban',
  'account_number',
  'card_number',
];

export const piiRedactionConfig = {
  // Global replacement for any unspecified PII
  globalReplaceWith: '[REDACTED]',
  
  // Enable/disable specific built-in detectors
  enabledDetectors: {
    names: true,
    emails: true,
    phones: true,
    addresses: true,
    creditCards: true,
    ssn: true,
    ipAddresses: true,
    urls: true,
    passwords: true,
  },
  
  // Custom patterns specific to banking/financial data
  customPatterns: bankingPiiPatterns,
  
  // Sensitive column names to watch for
  sensitiveColumns: sensitiveKeywords,
  
  // Logging configuration
  enableLogging: true,
  logLevel: 'info', // 'debug', 'info', 'warn', 'error'
};

export default piiRedactionConfig;
