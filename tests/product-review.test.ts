import assert from "node:assert/strict";
import test from "node:test";
import { productSaveStatus } from "../src/lib/product-review";

type ReviewProduct = NonNullable<Parameters<typeof productSaveStatus>[0]>;

function activeProduct(): ReviewProduct {
  return {
    status: "ACTIVE",
    title: "منتج معتمد",
    description: "الوصف المعتمد",
    categoryId: "category-1",
    imageUrl: null,
    price: 10000,
    compareAtPrice: 12000,
    deliveryType: "TEXT",
    deliveryContent: "private delivery",
    instructions: null,
    minQty: 1,
    maxQty: 10,
    options: [
      {
        name: "المدة",
        kind: "select",
        required: true,
        sortOrder: 0,
        values: [
          { label: "شهر", priceDelta: 0, sortOrder: 0 },
          { label: "سنة", priceDelta: 50000, sortOrder: 1 },
        ],
      },
      {
        name: "الإيميل",
        kind: "text",
        required: false,
        sortOrder: 1,
        values: [],
      },
    ],
    quantityDiscounts: [
      { minQty: 2, percentOff: 5 },
      { minQty: 5, percentOff: 10 },
    ],
  };
}

const edits: [string, (product: ReviewProduct) => void][] = [
  [
    "title",
    (p) => {
      p.title = "عنوان جديد";
    },
  ],
  [
    "description",
    (p) => {
      p.description = "وصف جديد";
    },
  ],
  [
    "price",
    (p) => {
      p.price += 100;
    },
  ],
  [
    "delivery content",
    (p) => {
      p.deliveryContent = "changed delivery";
    },
  ],
  [
    "category",
    (p) => {
      p.categoryId = "category-2";
    },
  ],
  [
    "delivery type",
    (p) => {
      p.deliveryType = "LINK";
    },
  ],
  [
    "instructions",
    (p) => {
      p.instructions = "تعليمات جديدة";
    },
  ],
  [
    "compare-at price",
    (p) => {
      p.compareAtPrice = 15000;
    },
  ],
  [
    "removing compare-at price",
    (p) => {
      p.compareAtPrice = null;
    },
  ],
  [
    "image",
    (p) => {
      p.imageUrl = "https://example.com/image.png";
    },
  ],
  [
    "minimum quantity",
    (p) => {
      p.minQty = 2;
    },
  ],
  [
    "maximum quantity",
    (p) => {
      p.maxQty = 20;
    },
  ],
  [
    "option name",
    (p) => {
      p.options[0].name = "خطة الاشتراك";
    },
  ],
  [
    "option kind",
    (p) => {
      p.options[0].kind = "text";
    },
  ],
  [
    "option required flag",
    (p) => {
      p.options[0].required = false;
    },
  ],
  [
    "adding an option",
    (p) => {
      p.options.push({
        name: "ملاحظات",
        kind: "text",
        required: false,
        values: [],
      });
    },
  ],
  [
    "removing an option",
    (p) => {
      p.options.pop();
    },
  ],
  [
    "option display order",
    (p) => {
      p.options[0].sortOrder = 2;
    },
  ],
  [
    "option value label",
    (p) => {
      p.options[0].values[0].label = "شهرين";
    },
  ],
  [
    "option value price delta",
    (p) => {
      p.options[0].values[0].priceDelta += 50000;
    },
  ],
  [
    "adding an option value",
    (p) => {
      p.options[0].values.push({ label: "يوم", priceDelta: -500 });
    },
  ],
  [
    "removing an option value",
    (p) => {
      p.options[0].values.pop();
    },
  ],
  [
    "option value display order",
    (p) => {
      p.options[0].values[0].sortOrder = 2;
    },
  ],
  [
    "discount threshold",
    (p) => {
      p.quantityDiscounts[0].minQty = 3;
    },
  ],
  [
    "discount percentage",
    (p) => {
      p.quantityDiscounts[0].percentOff = 20;
    },
  ],
  [
    "adding a discount",
    (p) => {
      p.quantityDiscounts.push({ minQty: 10, percentOff: 30 });
    },
  ],
  [
    "removing a discount",
    (p) => {
      p.quantityDiscounts.pop();
    },
  ],
];

for (const [name, edit] of edits) {
  test(`an ACTIVE product returns to review after changing ${name}, even when saving a draft`, () => {
    const previous = activeProduct();
    const next = structuredClone(previous);
    edit(next);
    assert.equal(productSaveStatus(previous, next, "DRAFT"), "PENDING_REVIEW");
  });
}

test("database IDs, physical row order, and null/empty optional text do not count as edits", () => {
  const previous = activeProduct();
  const next = structuredClone(previous);
  previous.options.reverse();
  previous.options[1].values.reverse();
  previous.quantityDiscounts.reverse();
  Object.assign(previous.options[1], {
    id: "old-option-id",
    productId: "product-1",
  });
  Object.assign(previous.options[1].values[0], { id: "old-value-id" });
  Object.assign(previous.quantityDiscounts[0], { id: "old-discount-id" });
  next.instructions = "";
  next.imageUrl = "";
  for (const option of next.options) {
    delete option.sortOrder;
    for (const value of option.values) delete value.sortOrder;
  }
  assert.equal(productSaveStatus(previous, next, "DRAFT"), "DRAFT");
  assert.equal(
    productSaveStatus(previous, next, "PENDING_REVIEW"),
    "PENDING_REVIEW",
  );
});

test("new and non-active products can still be saved as drafts or submitted", () => {
  const next = activeProduct();
  for (const status of [
    "DRAFT",
    "PENDING_REVIEW",
    "REJECTED",
    "PAUSED",
  ] as const) {
    const previous = { ...activeProduct(), status, title: "عنوان مختلف" };
    assert.equal(productSaveStatus(previous, next, "DRAFT"), "DRAFT");
    assert.equal(
      productSaveStatus(previous, next, "PENDING_REVIEW"),
      "PENDING_REVIEW",
    );
  }
  assert.equal(productSaveStatus(null, next, "DRAFT"), "DRAFT");
});
