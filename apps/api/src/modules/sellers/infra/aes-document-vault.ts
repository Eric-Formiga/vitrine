import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ENV } from '../../../shared/config/config.module.js';
import type { Env } from '../../../shared/config/env.js';
import type { DocumentVault, SealedDocument } from '../application/document-vault.port.js';

const VERSION = 'v1';
const IV_BYTES = 12;

// AES-256-GCM para guardar o documento e HMAC-SHA256 para a unicidade (ASM-016).
// As duas subchaves saem da SELLER_DOCUMENT_KEY por HKDF: a mesma chave nunca cifra e
// assina ao mesmo tempo. O IV é aleatório a cada gravação, então o mesmo CPF vira textos
// cifrados diferentes; por isso o índice único usa o hash, que é determinístico.
@Injectable()
export class AesDocumentVault implements DocumentVault {
  private readonly encryptionKey: Buffer;
  private readonly hashKey: Buffer;

  constructor(@Inject(ENV) env: Pick<Env, 'SELLER_DOCUMENT_KEY'>) {
    const master = Buffer.from(env.SELLER_DOCUMENT_KEY, 'base64');
    this.encryptionKey = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'vitrine:seller-document:enc', 32));
    this.hashKey = Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), 'vitrine:seller-document:mac', 32));
  }

  seal(digits: string): SealedDocument {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(digits, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encrypted = [VERSION, iv, tag, ciphertext].map((part) => (typeof part === 'string' ? part : part.toString('base64'))).join(':');
    return { encrypted, hash: this.hash(digits) };
  }

  hash(digits: string): string {
    return createHmac('sha256', this.hashKey).update(digits).digest('hex');
  }

  open(encrypted: string): string {
    const [version, iv, tag, ciphertext] = encrypted.split(':');
    if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error('Documento cifrado em formato desconhecido.');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  }
}
