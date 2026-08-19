# تقرير اختبار MindBuildMOAshraf

تم اختبار المحرك على commit `17479b9`، ثم تشغيله فعليًا من GitHub Actions على run [32304759088](https://github.com/Mohamed-Ashraf-Ai-Dev/MindBuildMOAshraf/actions/runs/32304759088).

| الاختبار | النتيجة |
|---|---|
| فحص بنية المحرك ومنع ملفات المفاتيح | ناجح |
| Debug APK محليًا | ناجح؛ `:app:assembleDebug` |
| Release APK محليًا بمفتاح JKS | ناجح؛ تحقق `apksigner` |
| Release AAB محليًا بمفتاح JKS | ناجح؛ تحقق `jarsigner` |
| Release APK محليًا بمفتاح PKCS12 | ناجح؛ تحقق `apksigner` |
| Release APK + AAB على GitHub Actions | ناجح |
| رفع artifact للمخرجات | ناجح |
| رفع keystore وmetadata كملفين منفصلين | ناجح |

## مخرجات GitHub Actions

| الملف | SHA-256 |
|---|---|
| `app-release.apk` | `932a54efd70edfdc5928d3be539d34671bd4971952d897bf4d95d4f4e4911500` |
| `app-release.aab` | `5b3dca251f6f907f937de744b31576e1fc207718966a4a339ad2fd8fe904d7b6` |
| keystore التجريبي المؤقت | `37ec2fcda43b1fbfcd85f381fc1a38d26058d89aad8e1c65da78091e1d105cd1` |

> مفتاح GitHub Actions المستخدم في هذا التشغيل كان **مؤقتًا للاختبار فقط** عبر `use_ephemeral_signing_key=true`. لا تستخدمه لتحديث تطبيق منشور. للإنتاج، ارفع مفتاحك الدائم JKS أو PKCS12 إلى Secrets من داخل تطبيقك أو من إعدادات GitHub، ثم اترك خيار المفتاح المؤقت معطلًا.

تحتوي مجموعة مخرجات التوقيع على ملفين فقط: keystore و`release-signing-metadata.json`. لا تحتوي metadata على كلمات المرور.
