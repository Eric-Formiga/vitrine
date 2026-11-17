// Fotos do produto (spec 03 H2): regras puras, sem Nest nem banco (ADR-0002).
import { DomainError } from '../../../shared/errors/domain-error.js';

export const IMAGES_MAX = 8;
export const ALT_MAX = 200;

/** Uma foto, na ordem: a de posição 0 é a capa. `color` nulo vale para todas as cores. */
export interface ProductImage {
  path: string;
  alt: string;
  position: number;
  color: string | null;
}

export interface ImageInput {
  path: string;
  alt: string;
  color: string | null;
}

/**
 * Por que o arquivo foi recusado:
 * - `outside-folder`: o caminho não é da pasta da loja;
 * - `not-uploaded`: a loja não pediu URL de upload para esse caminho;
 * - `missing`: o arquivo não chegou ao Storage;
 * - `type` e `size`: o arquivo real não é JPEG, PNG ou WebP, ou passa de 5 MB;
 * - `color`: nenhuma variante ativa do produto tem essa cor.
 */
export type ImageProblem = 'outside-folder' | 'not-uploaded' | 'missing' | 'type' | 'size' | 'color';

const MESSAGES: Record<ImageProblem, string> = {
  'outside-folder': 'O arquivo não é da sua loja.',
  'not-uploaded': 'Peça uma URL de upload para este arquivo antes de usá-lo.',
  missing: 'O arquivo não chegou ao Storage. Envie de novo.',
  type: 'O arquivo não é uma imagem JPEG, PNG ou WebP.',
  size: 'A imagem passa de 5 MB.',
  color: 'Nenhuma variante ativa do produto tem esta cor.',
};

/** A primeira imagem com problema, pela posição (AC-069). */
export class InvalidImageError extends DomainError {
  readonly code = 'INVALID_IMAGE';
  override readonly status = 422;

  constructor(position: number, reason: ImageProblem) {
    super(`Imagem ${position + 1}: ${MESSAGES[reason]}`, { position, reason });
  }
}
