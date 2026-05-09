import { APIGatewayProxyEvent } from "aws-lambda";
import { handler as getProductsList } from "../lambda/getProductsList";
import { handler as getProductsById } from "../lambda/getProductsById";
import { products } from "../mock/products";

const buildEvent = (pathParameters: Record<string, string> | null = null): APIGatewayProxyEvent =>
  ({ pathParameters } as unknown as APIGatewayProxyEvent);

describe("getProductsList", () => {
  test("returns 200 status code", async () => {
    const result = await getProductsList();
    expect(result.statusCode).toBe(200);
  });

  test("returns all products", async () => {
    const result = await getProductsList();
    const body = JSON.parse(result.body);
    expect(body).toHaveLength(products.length);
  });

  test("returns correct CORS header", async () => {
    const result = await getProductsList();
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
  });

  test("products have required fields", async () => {
    const result = await getProductsList();
    const body = JSON.parse(result.body);
    body.forEach((product: unknown) => {
      const p = product as Record<string, unknown>;
      expect(p).toHaveProperty("id");
      expect(p).toHaveProperty("title");
      expect(p).toHaveProperty("description");
      expect(p).toHaveProperty("price");
      expect(p).toHaveProperty("count");
    });
  });
});

describe("getProductsById", () => {
  test("returns 200 and product when valid ID provided", async () => {
    const validId = products[0].id;
    const result = await getProductsById(buildEvent({ productId: validId }));
    expect(result.statusCode).toBe(200);
    const body = JSON.parse(result.body);
    expect(body.id).toBe(validId);
    expect(body.title).toBe(products[0].title);
  });

  test("returns 404 when product not found", async () => {
    const result = await getProductsById(buildEvent({ productId: "non-existent-id" }));
    expect(result.statusCode).toBe(404);
    const body = JSON.parse(result.body);
    expect(body.message).toBe("Product not found");
  });

  test("returns 404 when productId is missing", async () => {
    const result = await getProductsById(buildEvent(null));
    expect(result.statusCode).toBe(404);
  });

  test("returns correct CORS header", async () => {
    const validId = products[0].id;
    const result = await getProductsById(buildEvent({ productId: validId }));
    expect(result.headers?.["Access-Control-Allow-Origin"]).toBe("*");
  });
});
