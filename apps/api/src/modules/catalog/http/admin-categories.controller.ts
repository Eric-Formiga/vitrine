import { Delete, Get, HttpCode, Patch, Post } from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation } from '@nestjs/swagger';
import { z } from 'zod';

import { Audited } from '../../../shared/audit/audited.decorator.js';
import { AdminController } from '../../../shared/auth/roles.decorator.js';
import { ApiProblems, ApiZodResponse } from '../../../shared/openapi/openapi.js';
import { IdParam } from '../../../shared/validation/id-param.pipe.js';
import { ZodBody } from '../../../shared/validation/zod-validation.js';
import { ArchiveCategoryUseCase } from '../application/archive-category.use-case.js';
import { CreateCategoryUseCase } from '../application/create-category.use-case.js';
import { GetCategoryTreeUseCase } from '../application/get-category-tree.use-case.js';
import { RestoreCategoryUseCase } from '../application/restore-category.use-case.js';
import { UpdateCategoryUseCase } from '../application/update-category.use-case.js';
import {
  type AdminCategory,
  type AdminCategoryNode,
  adminCategoryNodeSchema,
  adminCategorySchema,
  type CreateCategoryBody,
  createCategorySchema,
  toAdminCategory,
  toAdminNode,
  type UpdateCategoryBody,
  updateCategorySchema,
} from './category.dto.js';

// /v1/admin/categories — só admin (AC-021/AC-022); toda escrita é auditada (AC-030).
@AdminController('categories')
export class AdminCategoriesController {
  constructor(
    private readonly getTree: GetCategoryTreeUseCase,
    private readonly createCategory: CreateCategoryUseCase,
    private readonly updateCategory: UpdateCategoryUseCase,
    private readonly archiveCategory: ArchiveCategoryUseCase,
    private readonly restoreCategory: RestoreCategoryUseCase,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Árvore completa, com as arquivadas' })
  @ApiZodResponse(200, z.array(adminCategoryNodeSchema))
  async list(): Promise<AdminCategoryNode[]> {
    return (await this.getTree.execute({ includeArchived: true })).map(toAdminNode);
  }

  @Post()
  @Audited('category.create')
  @ApiOperation({ summary: 'Criar categoria', description: 'Sem slug, ele é gerado do nome.' })
  @ApiZodResponse(201, adminCategorySchema, 'Criada')
  @ApiProblems(400, 409, 422)
  async create(@ZodBody(createCategorySchema) body: CreateCategoryBody): Promise<AdminCategory> {
    return toAdminCategory(await this.createCategory.execute(body));
  }

  @Patch(':id')
  @Audited('category.update')
  @ApiOperation({ summary: 'Editar ou mover categoria' })
  @ApiZodResponse(200, adminCategorySchema)
  @ApiProblems(400, 409, 422)
  async update(@IdParam() id: string, @ZodBody(updateCategorySchema) body: UpdateCategoryBody): Promise<AdminCategory> {
    return toAdminCategory(await this.updateCategory.execute(id, body));
  }

  // DELETE arquiva: a categoria nunca é apagada (ASM-011).
  @Delete(':id')
  @HttpCode(204)
  @Audited('category.archive')
  @ApiOperation({ summary: 'Arquivar categoria (e as descendentes)', description: 'Nada é apagado; o slug continua reservado.' })
  @ApiNoContentResponse({ description: 'Arquivada' })
  async archive(@IdParam() id: string): Promise<void> {
    await this.archiveCategory.execute(id);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @Audited('category.restore')
  @ApiOperation({ summary: 'Restaurar categoria', description: 'Só ela volta; exige a pai ativa.' })
  @ApiZodResponse(200, adminCategorySchema)
  @ApiProblems(422)
  async restore(@IdParam() id: string): Promise<AdminCategory> {
    return toAdminCategory(await this.restoreCategory.execute(id));
  }
}
