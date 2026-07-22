// Shopify Storefront API glue for the Lonely Girl merch store.
//
// ─── TO CONNECT THE REAL SHOPIFY STORE ────────────────────────────────────────
// 1. Shopify admin → Settings → Apps and sales channels → Develop apps →
//    Create an app → Configure Storefront API scopes → enable
//    `unauthenticated_read_product_listings` → Install app.
// 2. Copy the Storefront API access token and set in .env.local:
//      NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
//      NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN=<storefront access token>
// 3. Restart the dev server. The placeholder products below disappear and the
//    live catalogue is fetched instead; Buy buttons link to each product's
//    Shopify page (which handles cart + checkout).
//
// Until then, /shop renders the placeholder previews with "Coming soon".
// ──────────────────────────────────────────────────────────────────────────────

export type Product = {
  id: string;
  title: string;
  description: string;
  price: string; // pre-formatted, e.g. "$28"
  category: "apparel" | "accessories" | "home" | "prints" | "stickers";
  image_url: string; // empty for placeholders → the card shows an icon block
  url: string; // Shopify product page URL; empty until the store is connected
};

const domain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN ?? "";
const token = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN ?? "";

export const shopifyConfigured = Boolean(
  domain && token && !domain.startsWith("your-store")
);

// Preview catalogue shown until Shopify is connected. Swap freely — titles and
// prices here are just placeholders for layout and vibe.
const PLACEHOLDER_PRODUCTS: Product[] = [
  {
    id: "ph-tee",
    title: "Static Tee",
    description: "Soft cotton tee with the Lonely Girl test-card logo.",
    price: "$28",
    category: "apparel",
    image_url: "",
    url: "",
  },
  {
    id: "ph-hoodie",
    title: "Off-Air Hoodie",
    description: "Heavyweight hoodie for late-night broadcasts.",
    price: "$58",
    category: "apparel",
    image_url: "",
    url: "",
  },
  {
    id: "ph-cap",
    title: "Antenna Cap",
    description: "Corduroy cap, embroidered rabbit-ears antenna.",
    price: "$24",
    category: "apparel",
    image_url: "",
    url: "",
  },
  {
    id: "ph-tote",
    title: "Test Card Tote",
    description: "Canvas tote in the room-colour palette.",
    price: "$18",
    category: "accessories",
    image_url: "",
    url: "",
  },
  {
    id: "ph-pin",
    title: "Enamel TV Pin",
    description: "Tiny retro TV, permanently on channel you.",
    price: "$12",
    category: "accessories",
    image_url: "",
    url: "",
  },
  {
    id: "ph-stickers",
    title: "Sticker Pack (8)",
    description: "All eight TVs from the pile, die-cut and glossy.",
    price: "$9",
    category: "stickers",
    image_url: "",
    url: "",
  },
  {
    id: "ph-mug",
    title: "Static Mug",
    description: "For coffee that keeps you tuned in.",
    price: "$16",
    category: "home",
    image_url: "",
    url: "",
  },
  {
    id: "ph-poster",
    title: "Channel 5 Poster",
    description: "A3 riso-style print of the TV pile.",
    price: "$22",
    category: "prints",
    image_url: "",
    url: "",
  },
];

export async function fetchProducts(): Promise<Product[]> {
  if (!shopifyConfigured) return PLACEHOLDER_PRODUCTS;

  // Live Shopify catalogue via the Storefront GraphQL API.
  const query = /* GraphQL */ `
    {
      products(first: 24, sortKey: BEST_SELLING) {
        edges {
          node {
            id
            title
            description
            tags
            onlineStoreUrl
            featuredImage {
              url
            }
            priceRange {
              minVariantPrice {
                amount
                currencyCode
              }
            }
          }
        }
      }
    }
  `;

  try {
    const res = await fetch(`https://${domain}/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Storefront-Access-Token": token,
      },
      body: JSON.stringify({ query }),
      next: { revalidate: 300 },
    });
    if (!res.ok) return PLACEHOLDER_PRODUCTS;
    const json = await res.json();
    type Edge = {
      node: {
        id: string;
        title: string;
        description: string;
        tags: string[];
        onlineStoreUrl: string | null;
        featuredImage: { url: string } | null;
        priceRange: { minVariantPrice: { amount: string; currencyCode: string } };
      };
    };
    const edges: Edge[] = json?.data?.products?.edges ?? [];
    const cats: Product["category"][] = ["apparel", "accessories", "home", "prints", "stickers"];
    return edges.map(({ node }) => {
      const price = node.priceRange.minVariantPrice;
      // Category comes from Shopify product tags — tag products "apparel",
      // "accessories", "home", "prints" or "stickers" in the admin.
      const category =
        cats.find((c) => node.tags.map((t) => t.toLowerCase()).includes(c)) ?? "accessories";
      return {
        id: node.id,
        title: node.title,
        description: node.description,
        price: new Intl.NumberFormat("en", {
          style: "currency",
          currency: price.currencyCode,
          maximumFractionDigits: 0,
        }).format(parseFloat(price.amount)),
        category,
        image_url: node.featuredImage?.url ?? "",
        url: node.onlineStoreUrl ?? "",
      };
    });
  } catch {
    return PLACEHOLDER_PRODUCTS;
  }
}
