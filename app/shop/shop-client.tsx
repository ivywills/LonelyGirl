"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/lib/shopify";

const CATEGORY_META: Record<Product["category"], { label: string; icon: string }> = {
  apparel: { label: "Apparel", icon: "apparel" },
  accessories: { label: "Accessories", icon: "shopping_bag" },
  home: { label: "Home", icon: "local_cafe" },
  prints: { label: "Prints", icon: "image" },
  stickers: { label: "Stickers", icon: "star" },
};

// Soft pastel blocks used while placeholder products have no photos.
const TILE_TINTS = ["#efe7fb", "#e4eefb", "#e2f4ec", "#fdf2dd", "#fbe7ee", "#eef0f3"];

export default function ShopClient({
  products,
  configured,
}: {
  products: Product[];
  configured: boolean;
}) {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<Product["category"] | null>(null);

  const cats = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    return (Object.keys(CATEGORY_META) as Product["category"][]).filter((c) => present.has(c));
  }, [products]);

  const visible = activeCat ? products.filter((p) => p.category === activeCat) : products;

  return (
    <div className="shop-theme">
      <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px 60px", width: "100%" }}>
        <header className="page-header" style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 6, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 26 }}>Lonely Girl Merch</h1>
          <button
            type="button"
            onClick={() => router.push("/")}
            style={{
              fontSize: 13,
              width: "auto",
              padding: 0,
              background: "transparent",
              border: "none",
              fontWeight: 400,
              color: "var(--accent)",
              cursor: "pointer",
            }}
          >
            change the channel
          </button>
        </header>
        <p style={{ color: "var(--muted)", fontSize: 14, marginBottom: 18 }}>
          Wear the static. Small-batch things from the pile of TVs.
        </p>

        {!configured && (
          <div
            style={{
              background: "var(--card)",
              border: "1px dashed var(--border)",
              borderRadius: 12,
              padding: "10px 16px",
              marginBottom: 20,
              fontSize: 13,
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span className="msr" style={{ fontSize: 16 }} aria-hidden>
              podcasts
            </span>
            This channel is still warming up — previews below, checkout opens soon.
          </div>
        )}

        {cats.length > 1 && (
          <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveCat(null)}
              style={{
                width: "auto",
                padding: "4px 14px",
                fontSize: 13,
                borderRadius: 999,
                background: activeCat === null ? "var(--accent)" : "var(--card)",
                color: activeCat === null ? "#ffffff" : "var(--muted)",
                border: "1px solid var(--border)",
              }}
            >
              Everything
            </button>
            {cats.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCat(activeCat === c ? null : c)}
                style={{
                  width: "auto",
                  padding: "4px 14px",
                  fontSize: 13,
                  borderRadius: 999,
                  background: activeCat === c ? "var(--accent)" : "var(--card)",
                  color: activeCat === c ? "#ffffff" : "var(--muted)",
                  border: "1px solid var(--border)",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span className="msr" style={{ fontSize: 14 }} aria-hidden>
                  {CATEGORY_META[c].icon}
                </span>
                {CATEGORY_META[c].label}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 18,
          }}
        >
          {visible.map((p, i) => (
            <div
              key={p.id}
              style={{
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: 16,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                boxShadow: "0 2px 10px rgba(43, 39, 51, 0.05)",
              }}
            >
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.title}
                  style={{ width: "100%", height: 170, objectFit: "cover", display: "block" }}
                />
              ) : (
                <div
                  style={{
                    height: 170,
                    background: TILE_TINTS[i % TILE_TINTS.length],
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span className="msr" style={{ fontSize: 44, color: "var(--accent)", opacity: 0.65 }} aria-hidden>
                    {CATEGORY_META[p.category].icon}
                  </span>
                </div>
              )}
              <div style={{ padding: "14px 16px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: 15 }}>{p.title}</p>
                {p.description && (
                  <p style={{ fontSize: 13, color: "var(--muted)", margin: "4px 0 0" }}>{p.description}</p>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginTop: "auto",
                    paddingTop: 14,
                    gap: 10,
                  }}
                >
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{p.price}</span>
                  {configured && p.url ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        marginLeft: "auto",
                        background: "var(--accent)",
                        color: "#ffffff",
                        borderRadius: 8,
                        padding: "7px 16px",
                        fontSize: 13,
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      Buy
                    </a>
                  ) : (
                    <button
                      disabled
                      title="Checkout opens when the Shopify store is connected"
                      style={{
                        marginLeft: "auto",
                        width: "auto",
                        padding: "7px 16px",
                        fontSize: 13,
                        borderRadius: 8,
                        background: "var(--bg)",
                        color: "var(--muted)",
                        border: "1px solid var(--border)",
                        cursor: "not-allowed",
                      }}
                    >
                      Coming soon
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/*
          ── SHOPIFY SECTIONS STILL TO WIRE UP ─────────────────────────────────
          • Cart: swap the per-product Buy links for a client-side cart using the
            Storefront API cartCreate / cartLinesAdd mutations, then redirect to
            cart.checkoutUrl.
          • Product detail pages: /shop/[handle] fetching productByHandle for
            size/variant pickers.
          • Collections: map Shopify collections onto the category chips above
            instead of tag-based categories.
          See lib/shopify.ts for the connection steps and .env.example for keys.
          ──────────────────────────────────────────────────────────────────────
        */}
        <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 40, textAlign: "center" }}>
          Every purchase keeps the TVs humming.
        </p>
      </main>
    </div>
  );
}
