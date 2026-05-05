
CREATE TABLE public.product_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  conversation_id uuid,
  customer_name text,
  requested_product text NOT NULL,
  message_snippet text,
  request_count integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_suggestions_user ON public.product_suggestions(user_id, status);
CREATE UNIQUE INDEX idx_product_suggestions_unique ON public.product_suggestions(user_id, lower(requested_product));

ALTER TABLE public.product_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own suggestions" ON public.product_suggestions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service insert suggestions" ON public.product_suggestions
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service update suggestions" ON public.product_suggestions
  FOR UPDATE TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Admins read all suggestions" ON public.product_suggestions
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_product_suggestions_updated_at
  BEFORE UPDATE ON public.product_suggestions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.products (user_id, name, name_bn, description, description_bn, price, image_url, category, keywords, is_active) VALUES
(
  'c7285f52-c79f-4ea4-b443-19e082a9d137',
  'COSRX Advanced Snail 92 All In One Cream (100g)',
  'কসআরএক্স অ্যাডভান্সড স্নেইল ৯২ অল ইন ওয়ান ক্রিম (১০০ গ্রাম)',
  'K-beauty cult-favorite moisturizer with 92% Snail Secretion Filtrate (Mucin). Deeply hydrates, repairs damaged skin barrier, fades acne marks & dark spots, plumps fine lines, gives a healthy glow. Lightweight gel-cream texture, fragrance-free, suitable for all skin types incl. sensitive & acne-prone. Apply morning & night as the last step before sunscreen. 100% original Korea.',
  'কোরিয়ান কে-বিউটির বেস্ট সেলার ময়েশ্চারাইজার — ৯২% স্নেইল মিউসিন (শামুক নির্যাস)। স্কিনকে গভীরভাবে হাইড্রেট করে, ড্যামেজড ব্যারিয়ার রিপেয়ার করে, ব্রণের দাগ ও কালো দাগ হালকা করে, ফাইন লাইন কমায় এবং ন্যাচারাল গ্লো আনে। হালকা জেল-ক্রিম টেক্সচার, খুশবু মুক্ত, সব ধরনের স্কিনে (সেনসিটিভ ও ব্রণপ্রবণ সহ) ব্যবহারযোগ্য। সকালে ও রাতে স্কিনকেয়ার রুটিনের শেষ ধাপে অল্প পরিমাণে লাগান। সাইজ: ১০০ গ্রাম। ১০০% অরিজিনাল কোরিয়া।',
  1350,
  'https://urtpathqupraeokaigzz.supabase.co/storage/v1/object/public/product-images/imports/snail92.jpg',
  'Moisturizer',
  ARRAY['cosrx','snail','snail 92','mucin','moisturizer','ময়েশ্চারাইজার','শামুক','স্নেইল','korean','glow','দাগ','barrier','hydration','cream','ক্রিম'],
  true
),
(
  'c7285f52-c79f-4ea4-b443-19e082a9d137',
  'COSRX Advanced Snail 96 Mucin Power Essence (100ml)',
  'কসআরএক্স অ্যাডভান্সড স্নেইল ৯৬ মিউসিন পাওয়ার এসেন্স (১০০ মিলি)',
  'Iconic essence with 96% Snail Secretion Filtrate. Repairs damaged skin, intensely hydrates, fades acne scars & dark spots, smooths texture and gives healthy bouncy skin. Lightweight, sticky-free finish, fragrance-free. Apply 2-3 drops on cleansed face morning & night before moisturizer. Best for dull, dry, irritated or acne-marked skin. 100% original Korea.',
  'কোরিয়ান বেস্ট সেলার ফেস এসেন্স — ৯৬% স্নেইল মিউসিন। ড্যামেজড স্কিন রিপেয়ার করে, গভীর হাইড্রেশন দেয়, ব্রণের দাগ ও কালো দাগ হালকা করে, স্কিন স্মুথ ও বাউন্সি করে। হালকা ও আঠালো নয়, খুশবু মুক্ত। ব্যবহারবিধি: পরিষ্কার মুখে সকালে ও রাতে ২-৩ ফোঁটা পুরো মুখে লাগান, এরপর ময়েশ্চারাইজার দিন। ডাল, শুষ্ক, ইরিটেটেড বা দাগযুক্ত স্কিনের জন্য পারফেক্ট। সাইজ: ১০০ মিলি। ১০০% অরিজিনাল কোরিয়া।',
  1690,
  'https://urtpathqupraeokaigzz.supabase.co/storage/v1/object/public/product-images/imports/snail96.png',
  'Essence',
  ARRAY['cosrx','snail','snail 96','mucin','essence','এসেন্স','শামুক','স্নেইল','korean','দাগ','scar','hydration','glow','repair'],
  true
),
(
  'c7285f52-c79f-4ea4-b443-19e082a9d137',
  'MISSHA Soft Finish Sun Milk SPF50+ PA+++ (70ml)',
  'মিশা সফট ফিনিশ সান মিল্ক SPF50+ PA+++ (৭০ মিলি)',
  'Lightweight Korean daily sunscreen with broad-spectrum SPF50+ PA+++. Soft milky texture absorbs instantly, leaves a matte non-greasy finish with NO white cast. Protects against UVA/UVB, prevents tanning, sunburn and premature aging. Suitable for all skin types incl. oily & sensitive. Apply 15 mins before sun exposure, reapply every 3-4 hours. 100% original Korea.',
  'কোরিয়ান ডেইলি সানস্ক্রিন — SPF50+ PA+++। হালকা মিল্কি টেক্সচার, দ্রুত শোষণ হয়, ম্যাট ফিনিশ দেয়, সাদা ভাব রাখে না, চিটচিটে নয়। UVA/UVB রশ্মি থেকে রক্ষা করে, ট্যান, সানবার্ন ও প্রিম্যাচিউর এজিং প্রতিরোধ করে। সব ধরনের স্কিনে (তৈলাক্ত ও সেনসিটিভ সহ) ব্যবহারযোগ্য। ব্যবহারবিধি: রোদে যাওয়ার ১৫ মিনিট আগে মুখে ও গলায় লাগান, প্রতি ৩-৪ ঘণ্টা পর পর রি-অ্যাপ্লাই করুন। সাইজ: ৭০ মিলি। ১০০% অরিজিনাল কোরিয়া।',
  1050,
  'https://urtpathqupraeokaigzz.supabase.co/storage/v1/object/public/product-images/imports/missha_sun.jpg',
  'Sunscreen',
  ARRAY['missha','sunscreen','সানস্ক্রিন','spf','spf50','sun milk','korean','no white cast','রোদ','ট্যান','tan','uv'],
  true
),
(
  'c7285f52-c79f-4ea4-b443-19e082a9d137',
  'CeraVe Ultra-Light Moisturizing Gel (52ml)',
  'সেরাভি আল্ট্রা-লাইট ময়েশ্চারাইজিং জেল (৫২ মিলি)',
  'Dermatologist-developed weightless gel moisturizer for all skin types — especially oily, combination & acne-prone. Gives immediate & long-lasting 24h hydration, restores skin barrier with 3 essential ceramides, niacinamide & hyaluronic acid. Fast-absorbing, oil-free, non-comedogenic, fragrance-free. Use morning & night after cleanser/serum. 100% original USA.',
  'ডার্মাটোলজিস্ট-ডেভেলপড হালকা জেল ময়েশ্চারাইজার — সব ধরনের স্কিনে, বিশেষ করে তৈলাক্ত, কম্বিনেশন ও ব্রণপ্রবণ স্কিনের জন্য পারফেক্ট। সাথে সাথে এবং দীর্ঘস্থায়ী ২৪ ঘণ্টা হাইড্রেশন দেয়, ৩টি এসেনশিয়াল সিরামাইড + নায়াসিনামাইড + হায়ালুরনিক অ্যাসিড দিয়ে স্কিন ব্যারিয়ার রিপেয়ার করে। দ্রুত শোষণ হয়, অয়েল-ফ্রি, পোর বন্ধ করে না, খুশবু মুক্ত। ব্যবহারবিধি: সকালে ও রাতে ক্লিনজার/সিরামের পর মুখে ও গলায় লাগান। সাইজ: ৫২ মিলি। ১০০% অরিজিনাল USA।',
  1190,
  'https://urtpathqupraeokaigzz.supabase.co/storage/v1/object/public/product-images/imports/cerave.jpg',
  'Moisturizer',
  ARRAY['cerave','moisturizer','ময়েশ্চারাইজার','gel','oily skin','তৈলাক্ত','ceramide','niacinamide','hyaluronic','lightweight','dermatologist','barrier'],
  true
),
(
  'c7285f52-c79f-4ea4-b443-19e082a9d137',
  'SKIN1004 Madagascar Centella Hyalu-Cica Water-Fit Sun Serum SPF50+ PA++++ (50ml)',
  'স্কিন১০০৪ মাদাগাস্কার সেন্টেলা হায়ালু-সিকা ওয়াটার-ফিট সান সিরাম SPF50+ PA++++ (৫০ মিলি)',
  'Bestselling Korean chemical sunscreen with broad-spectrum SPF50+ PA++++. Watery serum-like texture absorbs instantly with absolutely NO white cast or stickiness. Made with pure Centella Asiatica from Madagascar + Hyaluronic Acid — soothes irritation, calms redness, hydrates and protects sensitive/acne-prone skin. Reef-safe, vegan, fragrance-free. Apply 15 mins before sun, reapply every 3-4 hours. 100% original Korea.',
  'কোরিয়ান বেস্ট সেলার সানসিরাম — SPF50+ PA++++। পানির মতো হালকা সিরাম টেক্সচার, সাথে সাথে শোষণ হয়, একদম সাদা ভাব নেই, চিটচিটে নয়। মাদাগাস্কার থেকে আনা পিওর সেন্টেলা আসিয়াটিকা (সিকা) + হায়ালুরনিক অ্যাসিড — স্কিন শান্ত করে, লাল ভাব কমায়, গভীর হাইড্রেশন দেয় এবং সেনসিটিভ ও ব্রণপ্রবণ স্কিনকে রক্ষা করে। ভেগান, খুশবু মুক্ত, রিফ-সেফ। ব্যবহারবিধি: রোদে যাওয়ার ১৫ মিনিট আগে মুখে ও গলায় লাগান, প্রতি ৩-৪ ঘণ্টা পর পর রি-অ্যাপ্লাই করুন। সাইজ: ৫০ মিলি। ১০০% অরিজিনাল কোরিয়া।',
  1450,
  'https://urtpathqupraeokaigzz.supabase.co/storage/v1/object/public/product-images/imports/skin1004.png',
  'Sunscreen',
  ARRAY['skin1004','sunscreen','সানস্ক্রিন','spf','spf50','centella','cica','সিকা','sun serum','korean','no white cast','sensitive','hyaluronic','ব্রণ'],
  true
);
