import crypto from 'crypto';

// Get encryption key from environment or use a fixed dev key
const getEncryptionKey = (): Buffer => {
  const envKey = process.env.ENV_ENC_KEY;
  if (envKey) {
    try {
      return Buffer.from(envKey, 'base64');
    } catch (error) {
      console.warn('Invalid ENV_ENC_KEY format, using dev key');
    }
  }
  
  // Dev key for development (32 bytes)
  console.warn('⚠️  Using development encryption key. Set ENV_ENC_KEY for production.');
  return Buffer.from('dev-key-32-bytes-for-development-only-123', 'utf8');
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipher(ALGORITHM, getEncryptionKey());
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = (cipher as any).getAuthTag();
  
  // Combine IV, encrypted data, and auth tag
  const result = iv.toString('hex') + ':' + encrypted + ':' + tag.toString('hex');
  return Buffer.from(result).toString('base64');
}

export function decrypt(encryptedData: string): string {
  try {
    const data = Buffer.from(encryptedData, 'base64').toString('utf8');
    const [ivHex, encrypted, tagHex] = data.split(':');
    
    if (!ivHex || !encrypted || !tagHex) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipher(ALGORITHM, getEncryptionKey());
    (decipher as any).setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt data:', error);
    throw new Error('Failed to decrypt data');
  }
}
