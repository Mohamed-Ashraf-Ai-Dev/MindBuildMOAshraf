# MindBuild Studio

واجهة GitHub Pages الشخصية لمستودع `MindBuildMOAshraf`. تنشئ الواجهة ملفات Android/Kotlin القياسية من اسم التطبيق واسم الحزمة والإصدار والأيقونة، ثم ترفعها في commit ذري وتشغّل `build-android.yml` في GitHub Actions.

## الاستخدام

افتح صفحة GitHub Pages، ثم أدخل `Owner` و`Repository` و`Branch` وFine-grained PAT الخاص بك. يبقى التوكن في ذاكرة المتصفح للجلسة الحالية فقط ولا يُرفع للمستودع. اضغط **اختبار GitHub** قبل الرفع.

بعد إدخال اسم التطبيق واسم الحزمة، تظهر شجرة Android الفعلية. عند اختيار أيقونة تُكتب كملف `app/src/main/res/drawable/app_icon.png` ويتحول Manifest إلى `@drawable/app_icon`. في Release، ارفع JKS/PKCS12 وكلمات المرور واسم المفتاح؛ تُشفّر القيمة داخل المتصفح بـ Libsodium ثم تُرسل إلى GitHub Actions Secrets.

## متطلبات التوكن

التوكن Fine-grained يجب أن يكون مقيّدًا إلى هذا المستودع فقط، مع: `Contents: Read and write` و`Actions: Read and write` و`Workflows: Read and write` و`Metadata: Read-only`.

## أوامر التطوير

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm build
```

يُنشر الموقع تلقائيًا عبر `.github/workflows/deploy-studio-pages.yml` عند دفع تغييرات داخل `studio/` إلى `main`.
