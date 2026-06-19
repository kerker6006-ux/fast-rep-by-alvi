## Goal
Make the Products → "Add Product" dialog fully translated and remove leftover Bangla example text (replace with neutral examples like "t-shirt", "Red", "M, L, XL"). Texts must switch live with the language switcher.

## Problem
`src/components/ProductsManager.tsx` currently hardcodes English labels and uses Bangla examples in placeholders/hints (e.g. `"Red, মেরুন"`, `"M, L, XL"`, `"hijab, scarf, হিজাব"`, `"e.g. Hijab, Sharee"`, `"e.g. Cream, Pink, কালো"`, `"Color / রং"`, plus help text such as "Bot sends the exact color image customer asks for"). These never change when switching languages.

## Changes

### 1. `src/components/ProductsManager.tsx`
Replace every hardcoded English/Bangla string in the component with `t("products.form.<key>")` calls. Specifically:

- Dialog title: "Edit Product" / "Add New Product"
- Section labels: Category, Names (English / alternate), Price, Color, Size, Material
- All placeholders — strip Bangla examples and use neutral ones:
  - Category new input: `"e.g. T-shirt, Hijab"` → translated, no Bangla
  - Name: `"Product name"` → translated, e.g. "T-shirt"
  - Color: `"Red, Blue"` (remove `মেরুন`)
  - Size: `"M, L, XL"` (translated label, same example)
  - Material: `"Cotton"`
  - Keywords: `"t-shirt, cotton, summer"` (remove `হিজাব`)
  - Color variant name: `"e.g. Cream, Pink, Black"` (remove Bangla)
  - Size variant: `"50ml / 100ml / 250g"` (keep, neutral)
- AI section: "AI-Powered Descriptions", "Generate", "Click Generate or type manually..."
- Variants: "🎨 Color Variants", helper text, "Add Color", "No color variants yet.", example hint, color-name uppercase label, photo label, the "⚠️ Important" hint
- Size/ML Variants section + empty state
- Active toggle label "Active (Bot will show this)"
- Save button states already use `t("common.*")` — keep
- Stats: "Total Products", "Active", "Inactive", "Categories"
- Search placeholder, view-mode tooltips, "All", "Uncategorized" pill
- Empty state: "No products yet", description, "Add Your First Product"
- Preview modal: "Color Variants", "Size Options", "Active"/"Inactive", "Edit", "Delete"
- Toasts (keep English or translate — translate the user-facing ones: "Enter product name first", "AI description generated!", "AI generation failed", "Product updated!", "Product added!", "Product deleted!", "Product details filled by AI! Review and save.")

### 2. Locale JSON files
Add a `products.form.*` namespace (and reuse existing `products.*` where present) in all four locale files with full translations:

- `src/i18n/locales/en.json`
- `src/i18n/locales/bn.json`
- `src/i18n/locales/ko.json`
- `src/i18n/locales/es.json`

Each new key gets a translation in all four languages. Examples will use generic items (T-shirt, Hijab, Cotton, Red, M/L/XL) — no embedded Bangla in the English/Korean/Spanish placeholders.

### 3. No logic changes
Database fields, mutations, AI wizard wiring, image upload — all unchanged. Pure i18n + placeholder cleanup.

## Out of scope
Other pages (Orders, Leads, Bot Settings, etc.) — only the Products page was reported. If more Bangla leftovers exist elsewhere, please point them out and I will sweep them next.
