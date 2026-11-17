// ===== CONFIGURATION & CONSTANTS =====

export interface SampleHtmlTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  fileName: string;
  html: string;
}

export const SAMPLE_HTML_TEMPLATES: SampleHtmlTemplate[] = [
  {
    id: 'saas-landing',
    name: 'صفحه فرود پلتفرم ابری (SaaS)',
    category: 'چندستونه + شمارنده + سوالات متداول + فرم',
    description:
      'شامل هدر، بخش Hero گرادیان، ۳ ستون آمار شمارنده (Counter)، ۳ باکس آیکون ویژگی‌ها، سوالات متداول (Accordion) و فرم خبرنامه جهت تست جایگزینی Pro.',
    fileName: 'cloud-saas-landing.html',
    html: `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>پلتفرم مدیریت ابری نوا</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Vazirmatn', Tahoma, sans-serif;
      background-color: #F8FAFC;
      color: #0F172A;
      direction: rtl;
    }
    .hero-section {
      background: linear-gradient(135deg, #1E1B4B 0%, #312E81 100%);
      color: #FFFFFF;
      padding: 72px 48px;
      text-align: center;
    }
    .hero-section h1 {
      font-size: 40px;
      font-weight: 700;
      line-height: 60px;
      color: #FFFFFF;
      margin-bottom: 16px;
    }
    .hero-section p {
      font-size: 18px;
      line-height: 32px;
      color: #E0E7FF;
      margin-bottom: 28px;
    }
    .hero-btn {
      display: inline-block;
      background-color: #4F46E5;
      color: #FFFFFF;
      padding: 14px 32px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      font-size: 16px;
    }
    .stats-section {
      background-color: #FFFFFF;
      padding: 48px 40px;
      border-bottom: 1px solid #E2E8F0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 24px;
      text-align: center;
    }
    .stat-card {
      padding: 24px;
      background-color: #F8FAFC;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
    }
    .stat-card h3 {
      font-size: 34px;
      font-weight: 700;
      color: #4F46E5;
      margin-bottom: 8px;
    }
    .stat-card p {
      font-size: 15px;
      color: #475569;
    }
    .features-section {
      padding: 64px 40px;
      background-color: #F8FAFC;
    }
    .section-header {
      text-align: center;
      margin-bottom: 40px;
    }
    .section-header h2 {
      font-size: 28px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 12px;
    }
    .features-row {
      display: flex;
      flex-direction: row;
      gap: 24px;
    }
    .feature-box {
      flex: 1;
      background-color: #FFFFFF;
      padding: 28px;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
      box-shadow: 0 4px 16px rgba(15, 23, 42, 0.05);
    }
    .feature-box i {
      font-size: 24px;
      color: #4F46E5;
      margin-bottom: 12px;
      display: inline-block;
    }
    .feature-box h3 {
      font-size: 20px;
      font-weight: 600;
      color: #0F172A;
      margin-bottom: 10px;
    }
    .feature-box p {
      font-size: 14px;
      line-height: 24px;
      color: #475569;
    }
    .faq-contact-section {
      background-color: #FFFFFF;
      padding: 60px 40px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    .faq-box details {
      margin-bottom: 12px;
      padding: 16px;
      background-color: #F8FAFC;
      border-radius: 8px;
      border: 1px solid #E2E8F0;
    }
    .faq-box summary {
      font-weight: 600;
      color: #0F172A;
      cursor: pointer;
    }
    .faq-box p {
      margin-top: 10px;
      font-size: 14px;
      color: #475569;
    }
    .contact-card {
      padding: 28px;
      background-color: #F8FAFC;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
    }
    .contact-card h3 {
      font-size: 22px;
      margin-bottom: 16px;
      color: #0F172A;
    }
    @media (max-width: 767px) {
      .hero-section { padding: 40px 20px; }
      .hero-section h1 { font-size: 26px; line-height: 38px; }
      .features-row { flex-direction: column; }
    }
  </style>
</head>
<body>
  <section class="hero-section">
    <h1>زیرساخت ابری نسل جدید برای تیم‌های مهندسی</h1>
    <p>استقرار خودکار سرویس‌ها، پایش بلادرنگ و مقیاس‌پذیری هوشمند در کمتر از چند دقیقه</p>
    <a href="https://example.com/start" class="hero-btn">شروع رایگان ۱۴ روزه</a>
  </section>

  <section class="stats-section">
    <div class="stats-grid">
      <div class="stat-card counter">
        <h3>+14500</h3>
        <p>سرور ابری فعال</p>
      </div>
      <div class="stat-card counter">
        <h3>99%</h3>
        <p>پایداری سرویس سالانه</p>
      </div>
      <div class="stat-card counter">
        <h3>+820</h3>
        <p>تیم سازمانی enterprise</p>
      </div>
    </div>
  </section>

  <section class="features-section">
    <div class="section-header">
      <h2>قابلیت‌های کلیدی معماری ابری نوا</h2>
      <p>طراحی‌شده برای حداکثر کارایی، امنیت و سهولت مدیریت</p>
    </div>
    <div class="features-row">
      <div class="feature-box">
        <i class="fa-shield-alt">★</i>
        <h3>امنیت لایه‌ای پیشرفته</h3>
        <p>محافظت خودکار در برابر حملات DDoS به همراه فایروال اختصاصی و گواهی SSL آنی.</p>
      </div>
      <div class="feature-box">
        <i class="fa-bolt">⚡</i>
        <h3>پردازش توزیع‌شده سریع</h3>
        <p>توزیع هوشمند بار ترافیکی بین مراکز داده متعدد با کمترین تاخیر شبکه.</p>
      </div>
      <div class="feature-box">
        <i class="fa-chart-line">📊</i>
        <h3>پایش و گزارش‌گیری دقیق</h3>
        <p>داشبوردهای تحلیلی لحظه‌ای برای بررسی مصرف منابع و سلامت کانتینرها.</p>
      </div>
    </div>
  </section>

  <section class="faq-contact-section">
    <div class="faq-box">
      <details>
        <summary>آیا امکان ارتقای آنی منابع سرور وجود دارد؟</summary>
        <p>بله، در هر لحظه بدون قطعی سرویس می‌توانید رم و پردازنده سرور خود را ارتقا دهید.</p>
      </details>
      <details>
        <summary>پشتیبان‌گیری از داده‌ها به چه صورت انجام می‌شود؟</summary>
        <p>اسنپ‌شات‌های خودکار روزانه و هفتگی در فضای ذخیره‌سازی مجزا نگهداری می‌شوند.</p>
      </details>
    </div>
    <div class="contact-card">
      <h3>درخواست مشاوره تخصصی</h3>
      <form id="lead-form">
        <input type="text" name="fullname" placeholder="نام و نام خانوادگی" />
        <input type="email" name="email" placeholder="ایمیل سازمانی" />
        <button type="submit">ثبت درخواست مشاوره</button>
      </form>
    </div>
  </section>
</body>
</html>`,
  },
  {
    id: 'agency-portfolio',
    name: 'قالب شرکتی و معرفی محصول (با تصویر نسبی و لیست آیکون)',
    category: 'بخش دوتایی + لیست ویژگی + تصویر Placeholder',
    description:
      'شامل چیدمان دو ستونه معرفی محصول، لیست آیکون‌دار (icon-list)، تصویر با مسیر نسبی برای تست Placeholder خودکار و شبکه‌های اجتماعی.',
    fileName: 'agency-showcase.html',
    html: `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>استودیو طراحی و مهندسی</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Vazirmatn', sans-serif;
      background-color: #FFFFFF;
      color: #1E293B;
      direction: rtl;
    }
    .showcase-section {
      padding: 64px 48px;
      background-color: #F8FAFC;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 40px;
    }
    .showcase-content {
      flex: 6;
    }
    .showcase-content h2 {
      font-size: 32px;
      font-weight: 700;
      color: #0F172A;
      margin-bottom: 16px;
    }
    .showcase-content p {
      font-size: 16px;
      line-height: 28px;
      color: #475569;
      margin-bottom: 20px;
    }
    .showcase-list {
      list-style: none;
      margin-bottom: 24px;
    }
    .showcase-list li {
      font-size: 15px;
      color: #1E293B;
      margin-bottom: 10px;
    }
    .showcase-media {
      flex: 6;
      text-align: center;
    }
    .cta-button {
      display: inline-block;
      background-color: #0F172A;
      color: #FFFFFF;
      padding: 12px 28px;
      border-radius: 8px;
      text-decoration: none;
      font-size: 15px;
      font-weight: 600;
    }
    .footer-section {
      padding: 36px 48px;
      background-color: #0F172A;
      color: #F8FAFC;
      text-align: center;
    }
    .footer-section h4 {
      font-size: 18px;
      color: #FFFFFF;
      margin-bottom: 16px;
    }
    .social-links {
      display: flex;
      justify-content: center;
      gap: 16px;
    }
    .social-links a {
      color: #94A3B8;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <section class="showcase-section">
    <div class="showcase-content">
      <h2>طراحی سیستم‌های رابط کاربری مقیاس‌پذیر</h2>
      <p>ما به کسب‌وکارهای دیجیتال کمک می‌کنیم تا تجربه کاربری یکپارچه و منطبق با استانداردهای جهانی بسازند.</p>
      <ul class="showcase-list">
        <li>ساختار کاملاً ماژولار و قابل ویرایش در پنل وردپرس</li>
        <li>بهینه‌سازی کامل سرعت بارگذاری و Core Web Vitals</li>
        <li>سازگاری کامل با نمایشگرهای موبایل و تبلت</li>
      </ul>
      <a href="https://example.com/portfolio" class="cta-button">مشاهده نمونه کارها</a>
    </div>
    <div class="showcase-media">
      <img src="assets/images/dashboard-preview.png" width="560" height="380" alt="پیش‌نمایش داشبورد" style="border-radius: 14px;" />
    </div>
  </section>

  <footer class="footer-section">
    <h4>ما را در شبکه‌های اجتماعی دنبال کنید</h4>
    <div class="social-links">
      <a href="https://linkedin.com/company/example">LinkedIn</a>
      <a href="https://github.com/example">GitHub</a>
      <a href="https://twitter.com/example">Twitter</a>
      <a href="https://t.me/example">Telegram</a>
    </div>
  </footer>
</body>
</html>`,
  },
];
