# معماری و مکانیزم داخلی موتور تبدیل HTML به Elementor (`ARCHITECTURE.md`)

این سند برای برنامه‌نویسان و معماران نرم‌افزار نوشته شده است تا مکانیزم دقیق تبدیل صفحات پیچیده HTML/CSS/JS به ساختار بومی المنتور (`Elementor JSON Schema v0.4`) را گام‌به‌گام تشریح کند.

---

## ۱. نمای کلی پایپ‌لاین تبدیل (6-Stage Conversion Pipeline)

فرآیند تبدیل در فایل `src/App.tsx` (تابع `runConversion`) آغاز شده و شامل **۶ مرحله ترتیبی** است:

```text
[Raw HTML Input]
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Stage 1: Multi-Viewport Sandbox Measurement (src/services/htmlParser.ts) │
│  • Renders HTML in hidden iframe at 1440px, 1024px, and 390px            │
│  • Forces visibility on scroll-reveal elements ([data-reveal], .gf-item) │
│  • Captures getBoundingClientRect() + getComputedStyle() per element     │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Stage 2: Local SVG Extraction & Normalization (elementorBuilder.ts)      │
│  • Extracts every <svg> into ExtractedSvgAsset (assets/svg/svg-XXX.svg)  │
│  • Annotates DOM nodes with data-el-svg-id, width, height, and Data URL  │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Stage 3: 1:1 Exact-DOM Native Widget Compilation (elementorBuilder.ts)   │
│  • Recursively maps DOM nodes to Container, Heading, Button, Icon-Box,   │
│    Accordion/Toggle, Text-Editor, Image, Divider, or Media HTML          │
│  • Injects computed styles via injectComputedStylesIntoElementorController│
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Stage 4: Scoped CSS & Runtime JS Bridge Extraction (extraAssetsExtractor)│
│  • Parses <style> + Tailwind CDN rules, strips comments, scopes selectors│
│  • Generates dual-layer SVG icon CSS rules & zero-interference resets    │
│  • Wraps <script> logic with DOM Bridge for SVGs, Accordions & Wrappers  │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Stage 5: Self-Contained Inline Carrier Injection (elementorBuilder.ts)   │
│  • Optionally embeds extra.css + extra.js at the end of page.json so     │
│    single-file import into Elementor works out-of-the-box                │
└──────────────────────────────────────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────────────────────────────────┐
│ Stage 6: 20-Point Schema & Integrity Validation (src/services/validator) │
│  • Verifies unique 7-8 char hex IDs, elType/widgetType schema rules,     │
│    column sizes, font placeholders, and zero corrupt CSS selectors       │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## ۲. مرحله اول: اندازه‌گیری استایل‌های محاسبه‌شده در Sandbox (`src/services/htmlParser.ts`)

### ۲.۱. چرا `DOMParser` به‌تنهایی کافی نیست؟
`DOMParser` صرفاً درخت متنی HTML را می‌سازد اما موتور رندر مرورگر (Layout Engine) را اجرا نمی‌کند؛ بنابراین مقادیر واقعی CSS Grid، Flexbox، متغیرهای `:root`، عرض و ارتفاع دقیق آیکن‌ها و مقادیر ریسپانسیو در `@media` در دسترس نیستند.

### ۲.۲. مکانیزم `measureMultiViewportDom`
1. یک `<iframe>` مخفی با ابعاد دقیق دسکتاپ (`1440×900`) ساخته می‌شود.
2. یک استایل کمکی (`#__el-measure-override`) به داخل `iframe` تزریق می‌شود که انیمیشن‌ها و ترنزیشن‌ها را موقتاً غیرفعال کرده و عناصری که به واسطه اسکرول مخفی هستند (`[data-reveal]`, `.gf-reveal`, `.reveal`) را با `opacity: 1 !important; transform: none !important;` قابل‌مشاهده می‌کند تا ابعاد واقعی آن‌ها اندازه‌گیری شود.
3. به هر عنصر در DOM یک شناسه یکتا (`data-el-uid="el-1"`, `"el-2"`, ...) اختصاص داده می‌شود.
4. تابع `captureSnapshotForViewport` برای هر سه عرض (`1440px`، `1024px`، `390px`) اجرا شده و اطلاعات زیر را در ساختار `MultiViewportElementData` ذخیره می‌کند:
   - `rect`: مختصات و ابعاد دقیق (`width`, `height`, `top`, `left`).
   - تایپوگرافی: `fontFamily`, `fontSize`, `fontWeight`, `lineHeight`, `letterSpacing`, `textAlign`, `color`.
   - مدل جعبه‌ای (Box Model): `paddingTop/Right/Bottom/Left`, `marginTop/Right/Bottom/Left`, `borderRadius`, `borderWidth`, `borderStyle`, `borderColor`.
   - چیدمان: `display`, `flexDirection`, `justifyContent`, `alignItems`, `flexWrap`, `gap`, `rowGap`, `columnGap`, `gridTemplateColumns`, `position`, `zIndex`.

### ۲.۳. تزریق مستقیم به کنترلر المنتور (`injectComputedStylesIntoElementorController`)
این متد مقادیر استخراج‌شده از `MultiViewportElementData` را مستقیماً به پارامترهای استاندارد المنتور تبدیل می‌کند:
- برای `container`: پارامترهای `padding`, `margin`, `border_radius`, `flex_direction`, `flex_justify_content`, `flex_align_items`, `flex_gap`.
- برای `heading`: پارامترهای `title_color`, `typography_typography: 'custom'`, `typography_font_family`, `typography_font_size`, `typography_font_weight`, `typography_line_height`, `typography_letter_spacing`.
- برای `button`: پارامترهای `button_text_color`, `background_color`, `border_radius`, `text_padding`, `_padding`, `_margin`.
- برای `icon-box`: پارامترهای `primary_color`, `title_color`, `description_color`, `icon_size`, `icon_space`, `_padding`, `_margin`, `_border_radius`.
- برای `accordion` / `toggle`: پارامترهای `title_color`, `tab_active_color`, `title_background`, `content_color`, `content_background_color`, `title_padding`, `content_padding`, `_padding`, `_margin`, `_border_radius`.

---

## ۳. مرحله دوم: استخراج و محلی‌سازی فایل‌های SVG (`extractAndReplaceInlineSvgs`)

در فایل `src/services/elementorBuilder.ts`، پیش از پیمایش درخت DOM، تابع `extractAndReplaceInlineSvgs(doc, uidMap)` اجرا می‌شود:
1. تمام تگ‌های `<svg>` صفحه شناسایی می‌شوند.
2. اگر `<svg>` فاقد `viewBox` یا `width`/`height` صریح باشد، ابعاد دقیق رندرشده آن از `uidMap.get(uid)?.desktop.rect` خوانده شده و روی خود `<svg>` ثبت می‌گردد.
3. محتوای کامل XML هر آیکن با کدگذاری UTF-8 به فرمت `assets/svg/svg-001.svg` و همچنین یک `data:image/svg+xml;utf8,...` (جهت Fallback آنی) تبدیل می‌شود.
4. روی تگ `<svg>` ویژگی‌های `data-el-svg-id="001"`, `data-el-svg-path="assets/svg/svg-001.svg"`, `data-el-svg-w` و `data-el-svg-h` قرار می‌گیرد تا در مرحله ساخت ویجت‌ها استفاده شود.

---

## ۴. مرحله سوم: کامپایلر ۱:۱ درخت DOM به ویجت‌های بومی (`buildNativeWidgetsExactDomElementorJson`)

تابع `convertDomElementToNativeNode` در `src/services/elementorBuilder.ts` وظیفه تصمیم‌گیری برای هر گره DOM را بر عهده دارد. ترتیب اولویت قوانین (Cases) به شرح زیر است:

### Case 1: تگ‌های اسکریپت، استایل و لینک (`<script>`, `<style>`, `<link>`, `<meta>`)
نادیده گرفته می‌شوند؛ زیرا در مرحله چهارم به‌طور کامل در `extra.css` و `extra.js` استخراج و ایزوله می‌شوند.

### Case 1B: آکاردئون‌ها و پرسش‌های متداول (`widgetType: "accordion"`)
تابع `extractFaqAccordionItemParts(el)` بررسی می‌کند که آیا عنصر یکی از الگوهای زیر است یا خیر:
1. تگ استاندارد HTML5: `<details>` حاوی `<summary>` و محتوای پاسخ.
2. آیتم‌های سوالات متداول سفارشی با کلاس‌های `.gf-item`, `.faq-item`, `.accordion-item`, `.qa-item` یا عناصر فرزند مستقیم لیست‌های `.gf-list`, `.faq-list`, `.accordion-list` که دارای دو بخش مجزای «سوال/عنوان» و «پاسخ/محتوا» هستند.

در صورت تطابق، تابع `buildAccordionWidgetFromElement` یک ویجت بومی المنتور با ساختار زیر می‌سازد:
```json
{
  "id": "a1b2c3d",
  "elType": "widget",
  "widgetType": "accordion",
  "settings": {
    "tabs": [
      {
        "_id": "e4f5a6b",
        "tab_title": "متن دقیق سوال بدون تگ اضافی",
        "tab_content": "<p>محتوای کامل پاسخ با حفظ HTML</p>",
        "_title_classes": "...",
        "_content_classes": "...",
        "_is_open": false
      }
    ],
    "selected_icon": { "value": "fas fa-chevron-down", "library": "fa-solid" },
    "selected_active_icon": { "value": "fas fa-chevron-up", "library": "fa-solid" },
    "title_html_tag": "h3",
    "faq_schema": "yes",
    "_css_classes": "gf-item gf-n01 gf-reveal el-native-accordion"
  },
  "elements": []
}
```

### Case 1C & 1D: بازگشایی wrapperهای قالب قبلی المنتور
اگر فایل HTML ورودی خودش قبلاً از خروجی المنتور گرفته شده باشد (دارای `.elementor-section`, `.elementor-column`, `.elementor-widget-wrap`, `.elementor-widget-heading`, `.elementor-widget-text-editor` و ...)، این لایه‌های اضافه باز (Unwrap) می‌شوند تا از تودرتویی مضاعف جلوگیری شود و مستقیماً ویجت بومی متناظر تولید گردد.

### Case 1E: بازگشایی `.elementor-widget-html` غیررسانه‌ای
اگر در HTML ورودی بلوکی با کلاس `.elementor-widget-html` وجود داشته باشد که حاوی `<canvas>`, `<video>`, `<iframe>`, `<form>` یا `<table>` نیست (مثلاً بج‌های بالای هیرو یا متون ترکیبی)، موتور به جای تبدیل کورکورانه آن به ویجت `html`، فرزندان آن را واکاوی کرده و به کانتینر و ویجت‌های بومی (`heading`, `icon-box`, `button`) تبدیل می‌کند.

### Case 2: تصاویر (`<img>` و `<picture>`) ⬅ `widgetType: "image"`
تگ `<img>` به ویجت بومی `image` با کلاس `el-native-img` تبدیل می‌شود.

### Case 3: جداکننده‌ها (`<hr>`) ⬅ `widgetType: "divider"`
تگ `<hr>` به ویجت بومی `divider` تبدیل می‌شود.

### Case 4: دکمه‌ها و لینک‌های تعاملی (`<button>` و `<a>`) ⬅ `widgetType: "button"`
- اگر عنصر `<button>` باشد، یا تگ `<a>` باشد که فقط شامل متن و حداکثر یک آیکن (`<svg>` یا `<i>`) است، به ویجت بومی `button` با کلاس `el-native-btn` تبدیل می‌شود.
- اگر داخل دکمه یک `<svg>` وجود داشته باشد:
  - کلاس `el-svg-icon-<ID>` به ویجت اضافه می‌شود.
  - کد تمیز آیکن با رنگ `currentColor` در فیلد `_raw_icon_svg` ذخیره می‌شود تا هم در پیش‌نمایش و هم در وردپرس عیناً همان طرح آیکن رندر شود.
- اگر تگ `<a>` یک کارت پیچیده شامل چند تیتر و پاراگراف باشد، به `container` با `html_tag: "a"` تبدیل می‌شود تا ساختار فرزندها حفظ گردد.

### Case 5: باکس‌های آیکن و کارت‌های ویژگی ⬅ `widgetType: "icon-box"`
- تگ `<svg>` مستقیم یا ظرفی که تنها فرزندش یک `<svg>` است، و همچنین کارت‌های ویژگی که از «یک آیکن + یک تیتر + یک توضیح» تشکیل شده‌اند، به ویجت بومی `icon-box` با کلاس `el-native-icon-box` تبدیل می‌شوند.
- اگر تیتر یا توضیح کارت خالی باشد، CSS اختصاصی `.elementor-icon-box-content:empty { display: none !important; }` باعث می‌شود فقط خود آیکن با ابعاد دقیق رندر شود.

### Case 6 & 8: تیترها و برچسب‌های متنی ⬅ `widgetType: "heading"`
- تگ‌های `h1` تا `h6` و همچنین عناصر برگ (`span`, `div`, `label`, `strong`, `code`) که حاوی متن کوتاه یا تک‌خطی هستند به ویجت بومی `heading` با کلاس `el-native-heading` تبدیل می‌شوند.
- تگ‌های داخلی ساده با `cleanHeadingTitleHtml` پاک‌سازی می‌شوند تا فیلد `title` در ادیتور المنتور حاوی متن تمیز و بدون کد HTML مزاحم باشد.

### Case 7 & 9: پاراگراف‌ها و لیست‌ها ⬅ `widgetType: "text-editor"`
- تگ‌های `<p>`, `<blockquote>`, `<ul>`, `<ol>` به ویجت بومی `text-editor` تبدیل می‌شوند.

### Case 11: ظروف ساختاری و لایه‌های تزئینی ⬅ `elType: "container"`
- اگر عنصر فاقد متن و فرزند باشد (مانند لایه‌های نور، گرادیانت و خط‌کش‌های تزئینی)، یک کانتینر بومی خالی (`e-con`) با حفظ دقیق کلاس‌ها و تگ اصلی ساخته می‌شود.
- در غیر این صورت، یک `container` ساخته شده و تمامی فرزندان آن به‌صورت بازگشتی (و با پشتیبانی از Text Nodes ترکیبی) در آرایه `elements` آن قرار می‌گیرند.

---

## ۵. مرحله چهارم: ایزولاسیون CSS و پل زمان اجرا (`src/services/extraAssetsExtractor.ts`)

### ۵.۱. مکانیزم Scoping و تطبیق سلکتورهای CSS (`scopeSelectorList`)
برای اینکه استایل‌های صفحه اصلی با قالب وردپرس تداخل نکنند و در عین حال استایل‌های پیش‌فرض المنتور (`.e-con.e-flex`) را بازنویسی کنند:
1. تمام قوانین CSS با پیشوند مضاعف `.elementor-<slug>.elementor-<slug>` (Specificity معادل `(0,2,0)`) اسکوپ می‌شوند.
2. سلکتورهایی که در HTML اصلی تگ‌های خاصی را هدف گرفته بودند، به‌طور هوشمند با ساختار ویجت‌های بومی المنتور تطبیق داده می‌شوند:
   - `button` ⬅ `:is(button, .el-native-btn)`
   - `a` ⬅ `:is(a, .el-native-btn)`
   - `svg` ⬅ `:is(svg, img.el-svg-img)`
   - `details` ⬅ `:is(details:not(.elementor-accordion-item), .el-native-accordion:not(.gf-item))`
   - `summary` ⬅ `:is(summary:not(.elementor-tab-title), .el-native-accordion:not(.gf-item) .elementor-tab-title)`

### ۵.۲. حل قطعی مشکل آیکن‌های SVG و رنگ `:hover`
در المنتور استاندارد، ویجت‌های `icon-box` و `button` آیکن را از کتابخانه FontAwesome (`<i class="fas ...">`) رندر می‌کنند و استایل پایه المنتور روی `.elementor-button:hover` رنگ پس‌زمینه توپُر اعمال می‌کند. برای حل کامل این دو چالش:
1. **خنثی‌سازی استایل پایه دکمه در هاور**:
   ```css
   .elementor-slug .elementor-widget-button.el-native-btn .elementor-button,
   .elementor-slug .elementor-widget-button.el-native-btn .elementor-button:hover,
   .elementor-slug .elementor-widget-button.el-native-btn .elementor-button:focus {
     display: contents !important;
     color: inherit !important;
     background: transparent !important;
     border: 0 !important;
     padding: 0 !important;
     box-shadow: none !important;
   }
   ```
   به این ترتیب، استایل `:hover` دقیقاً از کلاس اصلی خود دکمه (روی wrapper ویجت) خوانده می‌شود.
2. **رندر دقیق آیکن SVG با `currentColor`**:
   - برای آیکن‌های خطی (`fill="none"` یا دارای `stroke`)، ویژگی `fill="none" stroke="currentColor"` و قانون CSS زیر اعمال می‌شود تا در هاور هرگز داخل آیکن توپُر نشود:
     ```css
     .elementor-slug svg[fill="none"],
     .elementor-slug .elementor-icon svg[fill="none"],
     .elementor-slug .elementor-button-icon svg[fill="none"] {
       fill: none !important;
       stroke: currentColor !important;
     }
     ```
   - برای هر آیکن استخراج‌شده (`el-svg-icon-001`)، هم قانون `-webkit-mask` در `extra.css` تولید می‌شود (برای نمایش فوری بدون نیاز به JS در ادیتور المنتور) و هم در `extra.js` تگ دقیق `<svg data-el-exact-svg="1">` درون `.elementor-icon` و `.elementor-button-icon` تزریق می‌گردد.

### ۵.۳. پل زمان اجرا (`domBridgeCode` در `extra.js`)
هنگامی که صفحه در وردپرس بارگذاری می‌شود، قبل از اجرای اسکریپت‌های اصلی صفحه (`rawScripts`)، کدهای زیر اجرا می‌شوند:
1. **تزریق کلاس‌های ریشه صفحه**: کلاس ایزوله `.elementor-<slug>` و کلاس‌های ریشه قالب (مانند `.gf-page`) به عنصر `.elementor` اضافه می‌شوند.
2. **تطبیق ساختار آکاردئون‌های سفارشی (`.gf-item.el-native-accordion`)**: اگر ویجت آکاردئون توسط PHP المنتور رندر شده باشد، عنوان و محتوای تب از `.elementor-tab-title` و `.elementor-tab-content` خوانده شده و ساختار `.gf-question` و `.gf-answer` بازسازی می‌شود تا اسکریپت‌های جستجو، فیلتر دسته‌بندی و انیمیشن ارتفاع (`Web Animations API`) بدون تغییر کار کنند.
3. **تزریق آیکن‌های دقیق SVG (`svgMarkupById`)**: جایگزینی آیکن‌های FontAwesome با کد دقیق `<svg data-el-exact-svg="1">`.
4. **بازسازی Wrapperهای میانی (`wrapperSpecs`)**: در حالت Legacy Section/Column در صورتی که نیاز به wrapper میانی بوده باشد، بر اساس `data-id` بازسازی می‌شود.

---

## ۶. مرحله ششم: اعتبارسنجی ۲۰گانه پیش از دانلود (`src/services/validator.ts`)

تابع `validateElementorOutput` پیش از فعال‌سازی دانلود، ۲۰ شرط فنی را بررسی می‌کند که مهم‌ترین آن‌ها عبارت‌اند از:
1. صحت ساختار ریشه (`version: "0.4"`, `type: "page"`, آرایه غیرخالی `content`).
2. یکتایی و فرمت هگزادسیمال ۷ یا ۸ کاراکتری تمامی شناسه‌های `id` در کل درخت.
3. رعایت سلسله‌مراتب مجاز المنتور (عدم قرارگیری `section` داخل `section`، یا عدم استفاده از `_column_size` روی `container`).
4. معتبر بودن نام تمامی `widgetType`ها (`heading`, `button`, `icon-box`, `accordion`, `text-editor`, `image`, `divider`, `spacer`, `html` و ...).
5. عدم وجود سلکتورهای شکسته یا کامنت‌های باقی‌مانده در `extra.css`.

---

## ۷. راهنمای توسعه و افزودن ویجت بومی جدید

اگر قصد دارید در آینده ویجت بومی جدیدی (مثلاً `counter`، `progress` یا `testimonial`) به کامپایلر ۱:۱ اضافه کنید، مراحل زیر را دنبال نمایید:

1. **تعریف تشخیص الگو در `src/services/elementorBuilder.ts`**:
   - در تابع `convertDomElementToNativeNode` یک Case جدید قبل از `CASE 11 (Container)` اضافه کنید.
   - یک تابع کمکی برای استخراج پارامترهای ویجت از عنصر DOM بنویسید و در انتها `injectComputedStylesIntoElementorController(el, uidMap, widgetType, settings)` را فراخوانی نمایید.
2. **افزودن پشتیبانی استایل در `src/services/htmlParser.ts`**:
   - نام ویجت جدید را به تایپ ورودی `injectComputedStylesIntoElementorController` اضافه کرده و کنترلرهای اختصاصی رنگ/تایپوگرافی آن را مقداردهی کنید.
3. **افزودن قانون Reset در `src/services/extraAssetsExtractor.ts`**:
   - در آرایه `scopedRuleBlocks.unshift(...)`، wrapperهای داخلی ویجت جدید را با `display: contents` یا `margin: 0; padding: 0;` تنظیم کنید تا استایل کلاس اصلی عنصر HTML بدون تداخل اعمال شود.
4. **افزودن رندر شبیه‌ساز در `src/components/ElementorVisualPreview.tsx`**:
   - در تابع `serializeElementorNodeToHtml`، مارکاپ استاندارد فرانت‌اند المنتور برای ویجت جدید را برگردانید تا در پیش‌نمایش زنده اپلیکیشن نیز دقیقاً مشابه وردپرس دیده شود.
