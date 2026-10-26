import assert from "node:assert/strict";
import test from "node:test";
import { addStockCodes } from "../src/lib/product-stock";

type StockStore = Parameters<typeof addStockCodes>[0];

function stockFixture() {
  // RESERVED is not in this phase's Prisma enum yet. The status-agnostic query
  // must also protect codes in future states without needing a new allowlist.
  const rows = [
    { productId: "product-1", content: "available-code", status: "AVAILABLE" },
    { productId: "product-1", content: "reserved-code", status: "RESERVED" },
    { productId: "product-1", content: "sold-code", status: "SOLD" },
    {
      productId: "another-product",
      content: "other-product-code",
      status: "SOLD",
    },
  ];
  let writes = 0;
  const stock: StockStore = {
    async findMany({ where }) {
      assert.equal(
        "status" in where,
        false,
        "deduplication must not restrict stock status",
      );
      return rows.filter(
        (row) =>
          row.productId === where.productId &&
          where.content.in.includes(row.content),
      );
    },
    async createMany({ data }) {
      writes++;
      rows.push(...data.map((row) => ({ ...row, status: "AVAILABLE" })));
      return { count: data.length };
    },
  };
  return { stock, rows, writes: () => writes };
}

test("upload excludes AVAILABLE, RESERVED and SOLD codes plus within-upload duplicates", async () => {
  const { stock, rows, writes } = stockFixture();
  const result = await addStockCodes(stock, "product-1", [
    "available-code",
    "reserved-code",
    "sold-code",
    "new-code",
    "new-code",
    "other-product-code",
  ]);
  assert.deepEqual(result, { added: 2, duplicates: 4 });
  assert.equal(writes(), 1);
  assert.equal(
    rows.filter(
      (row) => row.productId === "product-1" && row.content === "sold-code",
    ).length,
    1,
  );
  assert.deepEqual(rows.slice(-2), [
    { productId: "product-1", content: "new-code", status: "AVAILABLE" },
    {
      productId: "product-1",
      content: "other-product-code",
      status: "AVAILABLE",
    },
  ]);
});

test("a duplicate-only upload writes nothing and counts repeated sold codes", async () => {
  const { stock, writes } = stockFixture();
  assert.deepEqual(
    await addStockCodes(stock, "product-1", [
      "sold-code",
      "sold-code",
      "reserved-code",
    ]),
    { added: 0, duplicates: 3 },
  );
  assert.equal(writes(), 0);
});

test("a code uploaded earlier cannot be added again after being sold", async () => {
  const { stock, rows } = stockFixture();
  assert.deepEqual(await addStockCodes(stock, "product-1", ["AAAA-1"]), {
    added: 1,
    duplicates: 0,
  });
  rows.find((row) => row.content === "AAAA-1")!.status = "SOLD";
  assert.deepEqual(await addStockCodes(stock, "product-1", ["AAAA-1"]), {
    added: 0,
    duplicates: 1,
  });
  assert.equal(rows.filter((row) => row.content === "AAAA-1").length, 1);
});
