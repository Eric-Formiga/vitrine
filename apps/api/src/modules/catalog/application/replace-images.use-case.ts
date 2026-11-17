import { Inject, Injectable } from '@nestjs/common';

import { STORAGE_GATEWAY, type StorageGateway } from '../../media/application/storage-gateway.port.js';
import { isInSellerFolder, storedFileProblem } from '../../media/domain/upload.js';
import { assertCanChange, type Product } from '../domain/product.js';
import { type ImageInput, type ImageProblem, InvalidImageError, type ProductImage } from '../domain/product-image.js';
import { ProductNotFoundError } from '../domain/product-errors.js';
import { colorKey } from '../domain/variant.js';
import { PRODUCT_IMAGE_REPOSITORY, type ProductImageRepository } from './product-image.repository.js';
import { PRODUCT_REPOSITORY, type ProductRef, type ProductRepository } from './product.repository.js';
import { VARIANT_REPOSITORY, type VariantRepository } from './variant.repository.js';

export interface ProductImages {
  product: Product;
  images: ProductImage[];
}

// AC-068, AC-069: a lista inteira de fotos, na escrita versionada do produto (If-Match).
// Uma foto com problema recusa tudo, e a lista anterior fica como estava.
@Injectable()
export class ReplaceImagesUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepository,
    @Inject(VARIANT_REPOSITORY) private readonly variants: VariantRepository,
    @Inject(STORAGE_GATEWAY) private readonly storage: StorageGateway,
  ) {}

  async execute(ref: ProductRef, inputs: readonly ImageInput[]): Promise<ProductImages> {
    const fail = (position: number, reason: ImageProblem): never => {
      throw new InvalidImageError(position, reason);
    };
    const outside = inputs.findIndex((input) => !isInSellerFolder(input.path, ref.sellerId));
    if (outside >= 0) fail(outside, 'outside-folder');

    // O Storage é consultado antes da transação: a rede não segura a trava do produto.
    const files = await Promise.all(inputs.map((input) => this.storage.stat(input.path)));

    const { product, value } = await this.products.write(ref, async (current, tx) => {
      assertCanChange(current, 'edit');
      const registered = await this.images.registeredUploads(tx, ref.sellerId, inputs.map((input) => input.path));
      const active = await this.variants.findAll(tx, current.id);
      const colors = new Map(active.filter((v) => !v.archivedAt).map((v) => [colorKey(v.color), v.color]));

      const images = inputs.map((input, position): ProductImage => {
        const file = files[position] ?? null;
        if (!registered.has(input.path)) fail(position, 'not-uploaded');
        if (!file) return fail(position, 'missing');
        const problem = storedFileProblem(file);
        if (problem) fail(position, problem);
        // A cor fica com o nome que a variante usa ("preto" vira "Preto").
        const color = input.color === null ? null : (colors.get(colorKey(input.color)) ?? fail(position, 'color'));
        return { path: input.path, alt: input.alt, position, color };
      });

      await this.images.replace(tx, current.id, images);
      return { changes: {}, value: images };
    });
    return { product, images: value };
  }
}

/** As fotos que o vendedor vê para editar, com a versão do produto (o ETag). */
@Injectable()
export class ListImagesUseCase {
  constructor(
    @Inject(PRODUCT_REPOSITORY) private readonly products: ProductRepository,
    @Inject(PRODUCT_IMAGE_REPOSITORY) private readonly images: ProductImageRepository,
  ) {}

  async execute(sellerId: string, productId: string): Promise<ProductImages> {
    const product = await this.products.findOwned(sellerId, productId);
    if (!product) throw new ProductNotFoundError();
    return { product, images: await this.images.list(product.id) };
  }
}
