// PII Redaction utility for utilities data processing
// Alternative to Microsoft Presidio for JavaScript/TypeScript

import { SyncRedactor } from 'redact-pii-light';
import { piiRedactionConfig, bankingPiiPatterns } from './pii-config';

interface PiiRedactorConfig {
  globalReplaceWith?: string;
  customPatterns?: Array<{
    pattern: RegExp;
    replacement: string;
    description: string;
  }>;
  enabledDetectors?: {
    names?: boolean;
    emails?: boolean;
    phones?: boolean;
    addresses?: boolean;
    creditCards?: boolean;
    ssn?: boolean;
    ipAddresses?: boolean;
  };
}

export class PiiRedactor {
  private redactor: SyncRedactor;
  private config: PiiRedactorConfig;

  constructor(config: PiiRedactorConfig = {}) {
    // Merge with default banking configuration
    this.config = {
      ...piiRedactionConfig,
      ...config,
      customPatterns: [
        ...(bankingPiiPatterns || []),
        ...(config.customPatterns || []),
      ],
    };

    // Configure the redactor with built-in patterns
    this.redactor = new SyncRedactor({
      globalReplaceWith: this.config.globalReplaceWith,
      builtInRedactors: {
        names: {
          enabled: this.config.enabledDetectors?.names ?? true,
          replaceWith: '[NAME]',
        },
        emailAddress: {
          enabled: this.config.enabledDetectors?.emails ?? true,
          replaceWith: '[EMAIL]',
        },
        phoneNumber: {
          enabled: this.config.enabledDetectors?.phones ?? true,
          replaceWith: '[PHONE]',
        },
        streetAddress: {
          enabled: this.config.enabledDetectors?.addresses ?? true,
          replaceWith: '[ADDRESS]',
        },
        creditCardNumber: {
          enabled: this.config.enabledDetectors?.creditCards ?? true,
          replaceWith: '[CREDIT_CARD]',
        },
        usSocialSecurityNumber: {
          enabled: this.config.enabledDetectors?.ssn ?? true,
          replaceWith: '[SSN]',
        },
        ipAddress: {
          enabled: this.config.enabledDetectors?.ipAddresses ?? true,
          replaceWith: '[IP_ADDRESS]',
        },
        zipcode: {
          enabled: true,
          replaceWith: '[ZIPCODE]',
        },
        url: {
          enabled: true,
          replaceWith: '[URL]',
        },
        password: {
          enabled: true,
          replaceWith: '[PASSWORD]',
        },
      },
      customRedactors: {
        before: this.getCustomPatterns(),
      },
    });
  }

  private getCustomPatterns() {
    const patterns: Array<{ regexpPattern: RegExp; replaceWith: string }> = [];

    // Add patterns from configuration
    if (this.config.customPatterns) {
      this.config.customPatterns.forEach(pattern => {
        patterns.push({
          regexpPattern: pattern.pattern,
          replaceWith: pattern.replacement,
        });
      });
    }

    return patterns;
  }

  /**
   * Redact PII from a single text string
   */
  redactText(text: string): string {
    if (!text || typeof text !== 'string') {
      return text;
    }
    return this.redactor.redact(text);
  }

  /**
   * Redact PII from CSV data
   * Processes headers and data rows separately to preserve structure
   */
  redactCsvData(csvData: string, options: {
    preserveHeaders?: boolean;
    maxRows?: number;
  } = {}): string {
    const { preserveHeaders = true, maxRows = 50 } = options;

    const lines = csvData.split('\n');
    const redactedLines: string[] = [];

    // Process headers - KEEP ORIGINAL HEADERS, don't redact them
    if (lines.length > 0 && preserveHeaders) {
      // Keep headers as-is so the AI knows the actual column structure
      const headers = lines[0];
      redactedLines.push(headers); // Don't redact headers!
    }

    // Process data rows - ONLY redact the actual data
    const startIndex = preserveHeaders ? 1 : 0;
    const endIndex = Math.min(lines.length, startIndex + maxRows);

    for (let i = startIndex; i < endIndex; i++) {
      if (lines[i].trim()) {
        redactedLines.push(this.redactText(lines[i]));
      }
    }

    return redactedLines.join('\n');
  }

  /**
   * Get statistics about what was redacted
   */
  getRedactionStats(originalText: string, redactedText: string): {
    originalLength: number;
    redactedLength: number;
    redactionCount: number;
    redactionTypes: string[];
  } {
    const redactionMatches = redactedText.match(/\[[A-Z_]+\]/g) || [];
    
    return {
      originalLength: originalText.length,
      redactedLength: redactedText.length,
      redactionCount: redactionMatches.length,
      redactionTypes: [...new Set(redactionMatches)],
    };
  }

  /**
   * Validate if text likely contains PII before sending to AI
   */
  containsPii(text: string): boolean {
    const redacted = this.redactText(text);
    return redacted !== text;
  }
}

// Export a default instance with banking/financial configuration
export const defaultPiiRedactor = new PiiRedactor({
  globalReplaceWith: '[REDACTED]',
  // Banking-specific patterns are loaded from pii-config.ts
});

export default PiiRedactor;
