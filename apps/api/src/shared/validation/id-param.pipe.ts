import { NotFoundException, Param, type PipeTransform } from '@nestjs/common';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Id fora do formato é tratado como id inexistente (404): para quem chama, os dois
// são "isto não existe". E evita mandar ao Postgres um texto que não é UUID (erro 500).
export class IdParamPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!UUID.test(value)) throw new NotFoundException('Recurso não encontrado.');
    return value.toLowerCase();
  }
}

/** `@IdParam() id: string` — o parâmetro `:id` da rota, garantidamente um UUID. */
export const IdParam = (name = 'id'): ParameterDecorator => Param(name, new IdParamPipe());
