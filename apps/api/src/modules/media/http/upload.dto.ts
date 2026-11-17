import { z } from 'zod';

import { IMAGE_TYPE_LIST, MAX_UPLOAD_BYTES } from '../domain/upload.js';
import type { UploadTicket } from '../application/request-upload.use-case.js';

export const uploadRequestSchema = z
  .object({
    contentType: z.enum(IMAGE_TYPE_LIST, { error: 'Envie uma imagem JPEG, PNG ou WebP.' }),
    sizeBytes: z
      .int('Informe o tamanho em bytes.')
      .min(1, 'O arquivo está vazio.')
      .max(MAX_UPLOAD_BYTES, 'A imagem pode ter no máximo 5 MB.'),
  })
  .strict()
  .meta({ id: 'UploadRequestInput', description: 'O tipo e o tamanho do arquivo que o navegador vai enviar.' });

export type UploadRequestBody = z.output<typeof uploadRequestSchema>;

export const uploadTicketSchema = z
  .object({
    path: z.string().describe('Caminho no Storage; mande-o na lista de imagens do produto.'),
    uploadUrl: z.url().describe('Envie o arquivo com PUT e o cabeçalho Content-Type, sem login.'),
    expiresAt: z.iso.datetime().describe('Até quando a URL aceita o envio.'),
  })
  .meta({ id: 'UploadTicket' });

export type UploadTicketResponse = z.output<typeof uploadTicketSchema>;

export function toUploadTicket(ticket: UploadTicket): UploadTicketResponse {
  return { path: ticket.path, uploadUrl: ticket.uploadUrl, expiresAt: ticket.expiresAt.toISOString() };
}
