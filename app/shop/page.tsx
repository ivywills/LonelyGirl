import { fetchProducts, shopifyConfigured } from "@/lib/shopify";
import ShopClient from "@/app/shop/shop-client";

export const dynamic = "force-dynamic";

// The shop is public — browsing merch doesn't need an account.
export default async function ShopPage() {
  const products = await fetchProducts();
  return <ShopClient products={products} configured={shopifyConfigured} />;
}
