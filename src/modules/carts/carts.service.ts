import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import { AddToCartDto, UpdateCartItemDto, SyncCartDto } from './dto/index.js';

@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Customer: Get customer shopping cart with real-time price & stock calculations.
   */
  async getCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    const cartData = await this.prisma.cart.findUnique({
      where: { id: cart.id },
      include: {
        items: {
          orderBy: { createdAt: 'desc' },
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    category: {
                      select: { id: true, name: true, slug: true },
                    },
                    images: {
                      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                      take: 2,
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cartData) {
      throw new NotFoundException('Cart not found');
    }

    return this.calculateCartTotals(cartData);
  }

  /**
   * Customer: Add variant item to cart with live inventory verification.
   */
  async addItem(userId: string, addToCartDto: AddToCartDto) {
    const { productVariantId, quantity } = addToCartDto;

    // 1. Verify variant exists and is published
    let variant = await this.prisma.productVariant.findUnique({
      where: { id: productVariantId },
      include: {
        product: true,
      },
    });

    // Fallback: If productVariantId was passed as a Product ID, find its first published variant
    if (!variant) {
      variant = await this.prisma.productVariant.findFirst({
        where: {
          productId: productVariantId,
          product: { isPublished: true },
        },
        include: {
          product: true,
        },
      });
    }

    if (!variant || !variant.product.isPublished) {
      throw new NotFoundException(
        'Product variant is unavailable or does not exist',
      );
    }

    const resolvedVariantId = variant.id;

    // 2. Check stock availability
    if (variant.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Only ${variant.stock} item(s) available for ${variant.product.title} (${variant.size}, ${variant.color}).`,
      );
    }

    // 3. Get or create Cart
    const cart = await this.getOrCreateCart(userId);

    // 4. Check if item is already in cart
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productVariantId: {
          cartId: cart.id,
          productVariantId: resolvedVariantId,
        },
      },
    });

    if (existingItem) {
      const newQuantity = existingItem.quantity + quantity;
      if (variant.stock < newQuantity) {
        throw new BadRequestException(
          `Cannot add ${quantity} more. You already have ${existingItem.quantity} in cart and only ${variant.stock} are available.`,
        );
      }

      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: newQuantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId: resolvedVariantId,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  /**
   * Customer: Update line item quantity.
   */
  async updateItem(
    userId: string,
    cartItemId: string,
    updateCartItemDto: UpdateCartItemDto,
  ) {
    const { quantity } = updateCartItemDto;
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        variant: {
          include: { product: true },
        },
      },
    });

    if (!cartItem || cartItem.cartId !== cart.id) {
      throw new NotFoundException('Cart item not found in your cart');
    }

    if (cartItem.variant.stock < quantity) {
      throw new BadRequestException(
        `Insufficient stock. Only ${cartItem.variant.stock} available.`,
      );
    }

    await this.prisma.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
    });

    return this.getCart(userId);
  }

  /**
   * Customer: Remove line item from cart.
   */
  async removeItem(userId: string, cartItemId: string) {
    const cart = await this.getOrCreateCart(userId);

    const cartItem = await this.prisma.cartItem.findUnique({
      where: { id: cartItemId },
    });

    if (!cartItem || cartItem.cartId !== cart.id) {
      throw new NotFoundException('Cart item not found in your cart');
    }

    await this.prisma.cartItem.delete({
      where: { id: cartItemId },
    });

    return this.getCart(userId);
  }

  /**
   * Customer: Clear all items from shopping cart.
   */
  async clearCart(userId: string) {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return this.getCart(userId);
  }

  /**
   * Customer: Sync / merge guest cart items into user's DB cart upon login.
   */
  async syncCart(userId: string, syncCartDto: SyncCartDto) {
    const cart = await this.getOrCreateCart(userId);

    for (const item of syncCartDto.items) {
      const variant = await this.prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
      });

      if (!variant || variant.stock <= 0) {
        continue;
      }

      const cappedQuantity = Math.min(item.quantity, variant.stock);

      const existing = await this.prisma.cartItem.findUnique({
        where: {
          cartId_productVariantId: {
            cartId: cart.id,
            productVariantId: item.productVariantId,
          },
        },
      });

      if (existing) {
        const finalQuantity = Math.min(
          existing.quantity + cappedQuantity,
          variant.stock,
        );
        await this.prisma.cartItem.update({
          where: { id: existing.id },
          data: { quantity: finalQuantity },
        });
      } else {
        await this.prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productVariantId: item.productVariantId,
            quantity: cappedQuantity,
          },
        });
      }
    }

    return this.getCart(userId);
  }

  // ── Helper Methods ──────────────────────────────────────────

  private async getOrCreateCart(userId: string) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
      });
    }

    return cart;
  }

  private calculateCartTotals(cartData: {
    id: string;
    userId: string;
    items: Array<{
      id: string;
      quantity: number;
      createdAt: Date;
      updatedAt: Date;
      variant: {
        id: string;
        sku: string;
        size: string;
        color: string;
        colorCode: string;
        stock: number;
        extraPrice: import('@prisma/client').Prisma.Decimal;
        imageUrl?: string | null;
        product: {
          id: string;
          title: string;
          slug: string;
          basePrice: import('@prisma/client').Prisma.Decimal;
          discountPrice: import('@prisma/client').Prisma.Decimal | null;
          isPublished: boolean;
          category: { id: string; name: string; slug: string };
          images: Array<{
            url: string;
            altText?: string | null;
            isPrimary: boolean;
          }>;
        };
      };
    }>;
  }) {
    const FREE_SHIPPING_THRESHOLD = 2500; // Free shipping over 2500 BDT

    let subtotal = 0;
    let originalSubtotal = 0;
    let totalItems = 0;
    let hasOutOfStockItems = false;

    const lineItems = cartData.items.map((item) => {
      const { variant } = item;
      const { product } = variant;

      const basePriceNum = Number(product.basePrice);
      const discountPriceNum = product.discountPrice
        ? Number(product.discountPrice)
        : null;
      const extraPriceNum = Number(variant.extraPrice);

      const unitPrice = (discountPriceNum ?? basePriceNum) + extraPriceNum;
      const originalUnitPrice = basePriceNum + extraPriceNum;
      const itemTotal = unitPrice * item.quantity;
      const itemOriginalTotal = originalUnitPrice * item.quantity;

      subtotal += itemTotal;
      originalSubtotal += itemOriginalTotal;
      totalItems += item.quantity;

      const inStock = variant.stock > 0;
      const isQuantityAvailable = item.quantity <= variant.stock;
      if (!isQuantityAvailable) {
        hasOutOfStockItems = true;
      }

      return {
        id: item.id,
        quantity: item.quantity,
        unitPrice,
        originalUnitPrice,
        itemTotal,
        inStock,
        isQuantityAvailable,
        availableStock: variant.stock,
        variant: {
          id: variant.id,
          sku: variant.sku,
          size: variant.size,
          color: variant.color,
          colorCode: variant.colorCode,
          extraPrice: extraPriceNum,
          imageUrl: variant.imageUrl,
        },
        product: {
          id: product.id,
          title: product.title,
          slug: product.slug,
          category: product.category,
          primaryImage:
            product.images.find((img) => img.isPrimary) ||
            product.images[0] ||
            null,
        },
      };
    });

    const totalSavings = originalSubtotal - subtotal;
    const amountUntilFreeShipping = Math.max(
      0,
      FREE_SHIPPING_THRESHOLD - subtotal,
    );
    const qualifiesForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD;

    return {
      cartId: cartData.id,
      items: lineItems,
      summary: {
        uniqueItemCount: lineItems.length,
        totalItems,
        subtotal: Number(subtotal.toFixed(2)),
        originalSubtotal: Number(originalSubtotal.toFixed(2)),
        totalSavings: Number(totalSavings.toFixed(2)),
        qualifiesForFreeShipping,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        amountUntilFreeShipping: Number(amountUntilFreeShipping.toFixed(2)),
        hasOutOfStockItems,
      },
    };
  }
}
