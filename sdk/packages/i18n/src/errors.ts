import type { SupportedLanguage } from '@promptchain/schema';
import { I18nEngine } from './engine';

export type ErrorCode =
  | 'CID_TOO_LONG'
  | 'METADATA_URI_TOO_LONG'
  | 'CHANGELOG_URI_TOO_LONG'
  | 'LICENSE_NAME_TOO_LONG'
  | 'LICENSE_MISMATCH'
  | 'UNAUTHORIZED'
  | 'ARITHMETIC_OVERFLOW'
  | 'INVALID_LICENSE'
  | 'EMPTY_CID'
  | 'EMPTY_METADATA_URI'
  | 'SAME_AUTHORITY'
  | 'EMPTY_NAME'
  | 'ROYALTY_TOO_HIGH'
  | 'INSUFFICIENT_STAKE'
  | 'INVALID_RATING'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'NETWORK_ERROR'
  | 'RPC_ERROR'
  | 'TIMEOUT';

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  CID_TOO_LONG: 'CID exceeds maximum length of 70 bytes',
  METADATA_URI_TOO_LONG: 'Metadata URI exceeds maximum length of 200 bytes',
  CHANGELOG_URI_TOO_LONG: 'Changelog URI exceeds maximum length of 500 bytes',
  LICENSE_NAME_TOO_LONG: 'License name exceeds maximum length of 50 bytes',
  LICENSE_MISMATCH: 'Provided license does not match prompt license',
  UNAUTHORIZED: 'Signer does not match required authority',
  ARITHMETIC_OVERFLOW: 'Arithmetic operation overflowed',
  INVALID_LICENSE: 'Invalid or unlicensed prompt',
  EMPTY_CID: 'CID cannot be empty',
  EMPTY_METADATA_URI: 'Metadata URI cannot be empty',
  SAME_AUTHORITY: 'New authority must differ from current',
  EMPTY_NAME: 'License name cannot be empty',
  ROYALTY_TOO_HIGH: 'Royalty basis points exceed maximum of 10,000',
  INSUFFICIENT_STAKE: 'Stake below minimum requirement',
  INVALID_RATING: 'Rating must be between 1 and 5',
  NOT_FOUND: 'Resource not found',
  ALREADY_EXISTS: 'Resource already exists',
  NETWORK_ERROR: 'Network error',
  RPC_ERROR: 'RPC error',
  TIMEOUT: 'Request timed out',
};

export function formatError(code: ErrorCode, i18n: I18nEngine, extra?: string): string {
  const key = `error.${code.toLowerCase().replace(/_/g, '_')}` as any;
  const msg = i18n.t(key, { message: extra || '' } as any);
  return msg;
}
