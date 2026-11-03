import { Controller, Get } from '@nestjs/common';

import { Public } from '../../../shared/auth/public.decorator.js';
import { GetCategoryTreeUseCase } from '../application/get-category-tree.use-case.js';
import { type PublicCategoryNode, toPublicNode } from './category.dto.js';

// GET /v1/categories — a árvore pública, para o menu e as páginas de categoria (AC-023).
@Controller('categories')
@Public()
export class CategoriesController {
  constructor(private readonly getTree: GetCategoryTreeUseCase) {}

  @Get()
  async tree(): Promise<PublicCategoryNode[]> {
    return (await this.getTree.execute()).map(toPublicNode);
  }
}
