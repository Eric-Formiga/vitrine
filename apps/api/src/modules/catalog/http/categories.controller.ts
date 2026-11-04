import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';

import { Public } from '../../../shared/auth/public.decorator.js';
import { ApiZodResponse } from '../../../shared/openapi/openapi.js';
import { GetCategoryTreeUseCase } from '../application/get-category-tree.use-case.js';
import { type PublicCategoryNode, publicCategoryNodeSchema, toPublicNode } from './category.dto.js';

// GET /v1/categories — a árvore pública, para o menu e as páginas de categoria (AC-023).
@Controller('categories')
@Public()
@ApiTags('catálogo')
export class CategoriesController {
  constructor(private readonly getTree: GetCategoryTreeUseCase) {}

  @Get()
  @ApiOperation({ summary: 'Árvore de categorias ativas', description: 'Ordenada por posição e, empatadas, por nome.' })
  @ApiZodResponse(200, z.array(publicCategoryNodeSchema))
  async tree(): Promise<PublicCategoryNode[]> {
    return (await this.getTree.execute()).map(toPublicNode);
  }
}
