import type { Product, ProductStatus } from "@prisma/client";

type ReviewContent = Pick<
  Product,
  | "title"
  | "description"
  | "categoryId"
  | "imageUrl"
  | "price"
  | "compareAtPrice"
  | "deliveryType"
  | "deliveryContent"
  | "instructions"
  | "minQty"
  | "maxQty"
> & {
  options: {
    name: string;
    kind: string;
    required: boolean;
    sortOrder?: number;
    values: { label: string; priceDelta: number; sortOrder?: number }[];
  }[];
  quantityDiscounts: { minQty: number; percentOff: number }[];
};

function inDisplayOrder<T extends { sortOrder?: number }>(items: T[]) {
  return items
    .map((item, index) => ({ item, order: item.sortOrder ?? index }))
    .sort((a, b) => a.order - b.order)
    .map(({ item }) => item);
}

function reviewSnapshot(product: ReviewContent) {
  // Compare persisted content, not generated IDs or database row order.
  return JSON.stringify({
    title: product.title,
    description: product.description,
    categoryId: product.categoryId,
    imageUrl: product.imageUrl || null,
    price: product.price,
    compareAtPrice: product.compareAtPrice,
    deliveryType: product.deliveryType,
    deliveryContent: product.deliveryContent,
    instructions: product.instructions || null,
    minQty: product.minQty,
    maxQty: product.maxQty,
    options: inDisplayOrder(product.options).map((option) => ({
      name: option.name,
      kind: option.kind,
      required: option.required,
      values:
        option.kind === "select"
          ? inDisplayOrder(option.values).map((value) => ({
              label: value.label,
              priceDelta: value.priceDelta,
            }))
          : [],
    })),
    quantityDiscounts: product.quantityDiscounts
      .map(({ minQty, percentOff }) => ({ minQty, percentOff }))
      .sort((a, b) => a.minQty - b.minQty || a.percentOff - b.percentOff),
  });
}

export function productSaveStatus(
  previous: (ReviewContent & { status: ProductStatus }) | null,
  next: ReviewContent,
  intent: "DRAFT" | "PENDING_REVIEW",
): "DRAFT" | "PENDING_REVIEW" {
  return previous?.status === "ACTIVE" &&
    reviewSnapshot(previous) !== reviewSnapshot(next)
    ? "PENDING_REVIEW"
    : intent;
}
