import * as fs from 'fs';
import * as path from 'path';

const TEMPLATES_DIR = path.join(process.cwd(), 'email-templates');

/**
 * Load an email template file and replace {{variableName}} placeholders with the provided values.
 * @param name Template base name (e.g. 'welcome', 'password-reset')
 * @param ext File extension (default 'html')
 * @param vars Key-value map for placeholder replacement (e.g. { APP_NAME: 'Loyaltering', displayName: 'Jane' })
 * @returns Resolved template string, or empty string if file is missing (caller should handle fallback)
 */
export function loadEmailTemplate(
  name: string,
  ext: 'html' | 'txt' = 'html',
  vars: Record<string, string> = {}
): string {
  const filePath = path.join(TEMPLATES_DIR, `${name}.${ext}`);
  let content: string;
  try {
    content = fs.readFileSync(filePath, 'utf-8');
  } catch {
    return '';
  }
  return content.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}
