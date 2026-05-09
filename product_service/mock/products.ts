export type Product = {
  id: string;
  title: string;
  description: string;
  price: number;
  count: number;
};

export const products: Product[] = [
  {
    id: "a3f1e2d4-1a2b-4c3d-8e4f-5a6b7c8d9e0f",
    title: "Apple MacBook Pro 14",
    description: "14-inch MacBook Pro with M3 Pro chip, 18GB RAM, 512GB SSD. Perfect for professionals.",
    price: 1999,
    count: 5,
  },
  {
    id: "b4e2f3a5-2b3c-4d4e-9f5a-6b7c8d9e0f1a",
    title: "Sony WH-1000XM5",
    description: "Industry-leading noise canceling wireless headphones with 30-hour battery life.",
    price: 349,
    count: 12,
  },
  {
    id: "c5d3a4b6-3c4d-4e5f-af6b-7c8d9e0f1a2b",
    title: "Samsung Galaxy S24 Ultra",
    description: "Flagship Android smartphone with 200MP camera, S Pen, and Snapdragon 8 Gen 3.",
    price: 1299,
    count: 8,
  },
  {
    id: "d6e4b5c7-4d5e-4f6a-b07c-8d9e0f1a2b3c",
    title: "LG OLED C3 55\"",
    description: "55-inch OLED 4K TV with 120Hz refresh rate, Dolby Vision and Google TV.",
    price: 1199,
    count: 3,
  },
  {
    id: "e7f5c6d8-5e6f-4a7b-b18d-9e0f1a2b3c4d",
    title: "iPad Pro 12.9 M2",
    description: "12.9-inch iPad Pro with M2 chip, Liquid Retina XDR display, and USB-C Thunderbolt.",
    price: 1099,
    count: 7,
  },
  {
    id: "f8a6d7e9-6f7a-4b8c-b29e-0f1a2b3c4d5e",
    title: "Logitech MX Master 3S",
    description: "Advanced wireless mouse with 8K DPI sensor, quiet clicks, and USB-C charging.",
    price: 99,
    count: 25,
  },
  {
    id: "a9b7e8f0-7a8b-4c9d-93af-1a2b3c4d5e6f",
    title: "Dell UltraSharp U2723QE",
    description: "27-inch 4K USB-C monitor with IPS Black panel, 99% sRGB and built-in USB hub.",
    price: 649,
    count: 6,
  },
  {
    id: "b0c8f9a1-8b9c-4dae-a4b0-2b3c4d5e6f7a",
    title: "Keychron Q1 Pro",
    description: "Wireless mechanical keyboard with QMK/VIA support, gasket mount, and RGB backlight.",
    price: 199,
    count: 15,
  },
  {
    id: "c1d9a0b2-9c0d-4ebf-b5c1-3c4d5e6f7a8b",
    title: "GoPro HERO12 Black",
    description: "Action camera with 5.3K video, HyperSmooth 6.0 stabilization and waterproof design.",
    price: 399,
    count: 10,
  },
  {
    id: "d2e0b1c3-0d1e-4f80-b6d2-4d5e6f7a8b9c",
    title: "Anker 737 Power Bank",
    description: "24,000mAh power bank with 140W output, supports fast charging for laptops and phones.",
    price: 129,
    count: 20,
  },
  {
    id: "e3f1c2d4-1e2f-4091-b7e3-5e6f7a8b9c0d",
    title: "DJI Mini 4 Pro",
    description: "Foldable drone with 4K/60fps camera, obstacle sensing, and 34-minute flight time.",
    price: 759,
    count: 4,
  },
  {
    id: "f4a2d3e5-2f3a-4182-b8f4-6f7a8b9c0d1e",
    title: "Apple AirPods Pro 2",
    description: "True wireless earbuds with Active Noise Cancellation, Transparency mode and H2 chip.",
    price: 249,
    count: 18,
  },
];
