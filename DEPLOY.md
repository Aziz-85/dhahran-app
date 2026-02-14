# نشر تطبيق Dhahran Team على السيرفر

دليل رفع وتشغيل الموقع على سيرفر (VPS أو استضافة تدعم Node.js).

---

## نشر تلقائي (Ubuntu 22.04 / DigitalOcean)

على السيرفر بعد رفع المشروع إلى `/var/www/team-monitor` وتكوين `.env`:

```bash
cd /var/www/team-monitor
chmod +x scripts/deploy-server.sh
./scripts/deploy-server.sh
```

السكربت ينفّذ: تنظيف PM2 القديم، الصلاحيات، `npm install` و `npm run build`، Prisma generate + migrate، تشغيل PM2 على المنفذ 3002 (وضع fork)، تفعيل التشغيل عند إعادة التشغيل، والتحقق من الخدمة.

---

## المتطلبات على السيرفر

- **Node.js** 18 أو أحدث (يفضل 20 LTS)
- **PostgreSQL** قاعدة بيانات
- **npm** أو **pnpm**

---

## 1) رفع الملفات للسيرفر

### الطريقة أ: Git (مفضلة)

على السيرفر:

```bash
git clone <رابط-المستودع> dhahran-app
cd dhahran-app
```

### الطريقة ب: رفع أرشيف أو استخدام SCP/SFTP

من جهازك المحلي:

```bash
# إنشاء أرشيف (بدون node_modules و .env)
cd /path/to/dhahran-app
tar --exclude='node_modules' --exclude='.env' --exclude='.next' -czvf dhahran-app.tar.gz .

# رفع الملفات للسيرفر (غيّر user و host)
scp dhahran-app.tar.gz user@your-server-ip:/home/user/
```

على السيرفر:

```bash
mkdir -p dhahran-app && cd dhahran-app
tar -xzvf ../dhahran-app.tar.gz
```

---

## 2) تثبيت المتطلبات والبناء

على السيرفر داخل مجلد المشروع:

```bash
cd dhahran-app   # أو المسار الذي رفعت فيه المشروع

# تثبيت الحزم
npm install --production=false

# توليد عميل Prisma
npm run db:generate

# بناء التطبيق (Next.js)
npm run build
```

إذا ظهرت أخطاء في `npm run build` تأكد من وجود جميع متغيرات البيئة (انظر الخطوة 3).

---

## 3) ملف البيئة (.env) على السيرفر

أنشئ ملف `.env` في نفس مجلد المشروع:

```bash
nano .env
```

أضف على الأقل (عدّل القيم حسب سيرفرك وقاعدة البيانات):

```env
# رابط اتصال PostgreSQL على السيرفر
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/dhahran_db?schema=public"
```

احفظ الملف (في nano: `Ctrl+O` ثم `Enter` ثم `Ctrl+X`).

**مهم:** لا ترفع ملف `.env` إلى Git ولا تشاركه؛ أنشئه يدوياً على السيرفر فقط.

---

## 4) قاعدة البيانات

تأكد أن PostgreSQL يعمل وأنك أنشأت قاعدة البيانات. ثم نفّذ الهجرات:

```bash
# إنشاء الجداول وتطبيق الهجرات
npm run db:migrate
# أو إذا كنت تستخدم db push فقط:
# npm run db:push

# (اختياري) تشغيل البذور إذا كان عندك seed
# npm run db:seed
```

---

## 5) تشغيل التطبيق

### تشغيل مؤقت (للتجربة)

```bash
# التشغيل على المنفذ 3000
npm run start

# أو على منفذ معيّن
PORT=3001 npm run start
```

افتح في المتصفح: `http://عنوان-السيرفر:3000`

### تشغيل دائم باستخدام PM2 (مُوصى به)

1. تثبيت PM2 عالمياً:

```bash
npm install -g pm2
```

2. تشغيل التطبيق بملف الإعداد الجاهز:

```bash
pm2 start ecosystem.config.cjs
```

3. أوامر مفيدة:

```bash
pm2 status          # حالة التطبيق
pm2 logs            # عرض السجلات
pm2 restart all     # إعادة تشغيل
pm2 save            # حفظ القائمة
pm2 startup         # تشغيل تلقائي عند إعادة تشغيل السيرفر
```

---

## 6) وضع Nginx كـ Reverse Proxy (اختياري)

إذا أردت أن يعمل الموقع على المنفذ 80 أو 443 مع دومين:

1. ثبّت Nginx على السيرفر.
2. أنشئ ملف إعداد، مثلاً:

`/etc/nginx/sites-available/dhahran-team`:

```nginx
server {
    listen 80;
    server_name your-domain.com;   # غيّر إلى دومينك

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. تفعيل الموقع وإعادة تحميل Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/dhahran-team /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

لتفعيل HTTPS يمكن لاحقاً إضافة شهادة (مثلاً Let's Encrypt مع `certbot`).

---

## 7) تحديث الموقع بعد تعديلات جديدة

```bash
cd dhahran-app
git pull   # إذا كنت تستخدم Git
# أو ارفع الملفات الجديدة بنفس الطريقة التي استخدمتها أول مرة

npm install
npm run db:generate
npm run build
pm2 restart all
```

---

## ملخص أوامر سريع (بعد أول إعداد)

```bash
cd dhahran-app
npm install && npm run db:generate && npm run build
pm2 start ecosystem.config.cjs
pm2 save && pm2 startup
```

---

## استكشاف الأخطاء: P1000 (فشل مصادقة PostgreSQL)

إذا ظهر: **P1000: Authentication failed... the provided database credentials for USER are not valid**:

1. **التأكد من تشغيل PostgreSQL**
   ```bash
   sudo systemctl status postgresql
   ```

2. **إنشاء مستخدم وقاعدة بيانات (إن لم تكونا موجودتين)**
   ```bash
   sudo -u postgres psql -c "\du"                    # عرض المستخدمين
   sudo -u postgres psql -c "\l"                     # عرض قواعد البيانات
   sudo -u postgres createuser -P deploy              # إنشاء مستخدم deploy بكلمة مرور
   sudo -u postgres createdb -O deploy dhahran_db    # إنشاء قاعدة dhahran_db للمستخدم deploy
   ```

3. **السماح للمستخدم بالاتصال (pg_hba)**
   تأكد أن في ملف `pg_hba.conf` (مثلاً `/etc/postgresql/14/main/pg_hba.conf`) يوجد سطر للاتصال المحلي:
   ```text
   local   all   deploy   md5
   host    all   deploy   127.0.0.1/32   md5
   ```
   ثم إعادة تحميل الخدمة:
   ```bash
   sudo systemctl reload postgresql
   ```

4. **تعديل `.env` على السيرفر**
   استخدم نفس اسم المستخدم وكلمة المرور التي أنشأتها:
   ```env
   DATABASE_URL="postgresql://deploy:YOUR_PASSWORD@localhost:5432/dhahran_db?schema=public"
   ```

5. **اختبار الاتصال**
   ```bash
   cd /var/www/team-monitor
   npx prisma db pull
   # أو
   npx prisma migrate deploy
   ```

إذا واجهت خطأ معيّن (بناء، قاعدة بيانات، أو PM2) اذكر رسالة الخطأ وسأوضح لك الحل خطوة بخطوة.
