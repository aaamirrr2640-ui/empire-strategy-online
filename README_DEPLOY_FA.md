# راه‌اندازی آنلاین Empire Strategy

این نسخه برای میزبانی اینترنتی آماده شده است.

## مهم
باز کردن `index.html` از فایل‌منیجر گوشی باعث `Failed to fetch` می‌شود. بازی آنلاین باید از آدرس HTTPS سرور باز شود.

## گزینه پیشنهادی: Render + PostgreSQL/Supabase
1. کل پوشه `empire_online` را در یک مخزن GitHub قرار بده.
2. یک PostgreSQL آنلاین بساز (مثلاً Supabase یا PostgreSQL ارائه‌دهنده هاست).
3. مقدار اتصال PostgreSQL را به‌عنوان متغیر محیطی `DATABASE_URL` در سرویس قرار بده.
4. سرویس را با دستور `npm start` و Node 20 اجرا کن.
5. پس از Deploy، آدرس HTTPS سرویس را باز کن؛ همان آدرس صفحه بازی است.
6. تست کن: `https://YOUR-DOMAIN/api/health` باید JSON با `ok:true` برگرداند.

## متغیرهای محیطی
- `PORT`: توسط اکثر سرویس‌های هاست خودکار تنظیم می‌شود.
- `DATABASE_URL`: آدرس اتصال PostgreSQL. اگر تنظیم نشود، سرور از `db.json` استفاده می‌کند؛ این حالت برای هاست ابری مناسب نیست چون ممکن است فایل محلی بعد از ری‌استارت از بین برود.

## اجرای محلی
- Windows: `npm install` سپس `npm start`
- Android/Termux: `pkg install nodejs` سپس `npm install` و `npm start`
- مرورگر: `http://127.0.0.1:3000`

## نکته امنیتی
برای استفاده عمومی، HTTPS و PostgreSQL را فعال کن و کلید/رمز دیتابیس را فقط در Environment Variables هاست قرار بده.
