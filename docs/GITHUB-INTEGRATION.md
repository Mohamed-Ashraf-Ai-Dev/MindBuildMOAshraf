# دليل تكامل MindBuildMOAshraf مع GitHub

هذا الدليل يحدد كل ما يحتاجه تطبيق Android شبيه بـ AIDE لكي يرفع مشروع Kotlin، يشغل البناء، يتابع الوظائف، ينزل APK/AAB، يدير مفتاح توقيع Release، ويحذف المخرجات القديمة. النسخة الحالية تستخدم GitHub REST API مع `Fine-grained Personal Access Token`، وتحتوي طبقة Kotlin جاهزة في:

```text
app/src/main/java/com/mindbuildmoashraf/engine/
├── GitHubActionsClient.kt
├── GitHubSecretEncryptor.kt
├── MindBuildEngine.kt
├── SecureGitHubTokenStore.kt
└── BuildModels.kt
```

> **قاعدة أمان:** لا تضع التوكن أو keystore أو كلمة مرور التوقيع في Git أو `BuildConfig` أو Logcat أو رابط تحميل. احفظ توكن GitHub داخل Android Keystore، وأرسل مواد توقيع Android إلى GitHub Actions Secrets مشفرة فقط.

## 1. إعداد المستودع

المحرك مصمم لمستودع واحد لكل مشروع أو مساحة عمل، مثل:

```text
https://github.com/Mohamed-Ashraf-Ai-Dev/MindBuildMOAshraf
```

قبل استخدام التطبيق، يجب أن يحتوي المستودع على:

| المكوّن | الغرض |
|---|---|
| `.github/workflows/build-android.yml` | استقبال `workflow_dispatch` وبناء Debug/Release |
| `gradlew` و`gradle/wrapper` | تثبيت نسخة Gradle وعدم الاعتماد على جهاز المستخدم |
| `settings.gradle.kts` و`build.gradle.kts` | تعريف مشروع Android/Kotlin |
| `app/` أو وحدات المشروع | كود Kotlin وموارد Android الطبيعية |
| `scripts/verify-release.sh` | التحقق من توقيع APK/AAB وSHA-256 |

تطبيق AIDE يحتفظ بشجرة الملفات كاملة. أي ملف مثل `AndroidManifest.xml` أو `mipmap-*` أو `drawable-*` أو `assets` أو Kotlin أو XML أو Gradle يرفع كجزء من المشروع.

## 2. نوع التوكن الموصى به لوضع الهاتف الشخصي

بما أن التطبيق سيبقى على هاتفك ولن يخرج لمستخدمين آخرين، استخدم **Fine-grained Personal Access Token قويًا مخصصًا لمستودع MindBuildMOAshraf فقط**. لا تحتاج إلى GitHub App أو خادم وسيط في هذا السيناريو؛ التطبيق يتصل مباشرة بـ GitHub عبر HTTPS.

يمكنك اختيار مدة طويلة أو `No expiration` إذا كان هذا حسابك الشخصي والهاتف تحت سيطرتك، لكن لا تجعل التوكن جزءًا من APK أو مستودع Git. في حالة فقد الهاتف أو الاشتباه في التسريب، ألغِ التوكن من GitHub فورًا وأنشئ واحدًا جديدًا.

الإعداد القوي الذي يغطي وظائف المحرك الحالية هو:

| Repository permission | المستوى | لماذا؟ |
|---|---:|---|
| `Contents` | `Read and write` | رفع ملفات المشروع، Git Blobs/Trees/Commits، وقراءة branch/ref |
| `Actions` | `Read and write` | تشغيل workflow، قراءة runs/jobs/logs، تنزيل وحذف artifacts، الإلغاء وإعادة التشغيل |
| `Workflows` | `Read and write` | مطلوب إذا كان التطبيق سيعدل `.github/workflows/*` عبر Contents API |
| `Metadata` | `Read-only` | بيانات المستودع الأساسية، وغالبًا تكون مطلوبة تلقائيًا |

لا تضف `Administration` أو `Issues` أو `Pull requests` أو `Webhooks` أو `Deployments` إلا إذا أضفت ميزة فعلية تحتاجها. الصلاحيات الرسمية لكل endpoint موضحة في [دليل صلاحيات Fine-grained Tokens][1].

إذا كان التطبيق سيستخدم Releases حقيقية لتوزيع APK/AAB، أضف `Contents: Read and write`، لأن إنشاء Release ورفع أصوله مرتبطان بصلاحيات محتوى المستودع. إذا أردت لاحقًا إنشاء Webhook لتحديثات البناء، أضف `Webhooks: Read and write` فقط عند تفعيل هذه الميزة.

### إنشاء التوكن

من GitHub افتح `Settings → Developer settings → Fine-grained personal access tokens → Generate new token`. استخدم اسمًا مثل `MindBuild-AIDE-Personal`، واختر `Only select repositories` ثم `MindBuildMOAshraf`، وفَعّل `Contents: Read and write` و`Actions: Read and write` و`Workflows: Read and write` و`Metadata: Read-only`. هذا الملف يعطي التطبيق كل وظائف البناء الحالية من دون صلاحيات إدارة حساب GitHub أو مستودعات أخرى.

احفظ التوكن في التطبيق من خلال `SecureGitHubTokenStore`، وأضف في الواجهة زري `اختبار الاتصال` و`مسح التوكن`. لا تعرض القيمة نفسها بعد الحفظ. خيار GitHub App يظل مناسبًا فقط إذا تحوّل المشروع مستقبلًا إلى تطبيق متعدد المستخدمين؛ ليس مطلوبًا لوضعك الشخصي.

## 3. رؤوس كل طلب API

كل طلب إلى GitHub يجب أن يحتوي:

```http
Authorization: Bearer <GITHUB_TOKEN>
Accept: application/vnd.github+json
X-GitHub-Api-Version: 2026-03-10
User-Agent: MindBuildMOAshraf-AIDE
Content-Type: application/json; charset=utf-8
```

العنوان الأساسي:

```text
https://api.github.com
```

لا تسجل `Authorization` في السجل. في التطبيق الحالي يتم تمرير التوكن من `SecureGitHubTokenStore` عبر `tokenProvider`.

## 4. دورة رفع المشروع

### 4.1 التحقق من المستودع والفرع

قبل الرفع، يستحسن تنفيذ:

```http
GET /repos/{owner}/{repo}
GET /repos/{owner}/{repo}/git/ref/heads/{branch}
```

الأول يتحقق من الاسم والخصوصية والصلاحيات، والثاني يعيد SHA الحالي للفرع. إذا كان الفرع غير موجود، اعرض خطأ واضحًا بدل إنشاء فرع عشوائي.

### 4.2 الرفع الذري الموصى به

المحرك الحالي يستخدم Git Data API في `uploadProjectSnapshotAtomic`، ويجري الخطوات التالية:

| الترتيب | الطلب | الغرض |
|---:|---|---|
| 1 | `GET /repos/{owner}/{repo}/git/ref/heads/{branch}` | معرفة commit الحالي |
| 2 | `GET /repos/{owner}/{repo}/git/commits/{commit_sha}` | معرفة tree الحالي |
| 3 | `POST /repos/{owner}/{repo}/git/blobs` | رفع محتوى كل ملف Base64 والحصول على blob SHA |
| 4 | `POST /repos/{owner}/{repo}/git/trees` | إنشاء tree جديد مبني على tree القديم |
| 5 | `POST /repos/{owner}/{repo}/git/commits` | إنشاء commit واحد لكل Sync |
| 6 | `PATCH /repos/{owner}/{repo}/git/refs/heads/{branch}` | تحريك الفرع إلى commit الجديد بدون force push |

مثال blob:

```json
{
  "content": "<BASE64_FILE_CONTENT>",
  "encoding": "base64"
}
```

مثال عنصر tree:

```json
{
  "path": "app/src/main/java/com/example/MainActivity.kt",
  "mode": "100644",
  "type": "blob",
  "sha": "<BLOB_SHA>"
}
```

إذا حدث تعارض بسبب تغيير الفرع بين قراءة ref وتحديثه، أعد الدورة من البداية مع نسخة جديدة من `baseSha`. لا تستخدم `force: true` في تطبيق البناء.

### 4.3 Contents API البديل

لملف منفرد أو تعديل صغير يمكن استخدام:

```http
GET /repos/{owner}/{repo}/contents/{path}?ref={branch}
PUT /repos/{owner}/{repo}/contents/{path}
```

جسم PUT:

```json
{
  "message": "Sync file from MindBuild editor",
  "content": "<BASE64_CONTENT>",
  "sha": "<EXISTING_SHA_IF_UPDATE>",
  "branch": "main"
}
```

لا تستخدم Contents API واحدًا لكل ملف في مشروع كبير، لأنه ينشئ commit مستقلًا لكل ملف ويزيد احتمال ترك المستودع نصف محدث. النسخة الحالية أبقت `uploadProjectSnapshot` كـ fallback، لكن دورة البناء الرئيسية تستخدم الرفع الذري.

## 5. رفع مفتاح توقيع Release

### 5.1 الحصول على public key الخاص بـ Secrets

```http
GET /repos/{owner}/{repo}/actions/secrets/public-key
```

الاستجابة:

```json
{
  "key_id": "123456789",
  "key": "<BASE64_LIBSODIUM_PUBLIC_KEY>"
}
```

### 5.2 تشفير كل قيمة

يجب تشفير القيمة بـ Libsodium `crypto_box_seal` باستخدام public key السابق، ثم تحويل الناتج إلى Base64 عادي. لا تستخدم AES الخاص بالتطبيق لتعبئة `encrypted_value`؛ AES مناسب لتخزين التوكن محليًا، أما GitHub Secrets فيتطلب sealed box بـ Libsodium.

القيم التي يرفعها المحرك:

| Secret name | القيمة |
|---|---|
| `RELEASE_KEYSTORE_B64` | Base64 لمحتوى JKS أو PKCS12 |
| `RELEASE_STORE_PASSWORD` | كلمة مرور keystore |
| `RELEASE_STORE_TYPE` | `JKS` أو `PKCS12` |
| `RELEASE_KEY_ALIAS` | اسم المفتاح داخل keystore |
| `RELEASE_KEY_PASSWORD` | كلمة مرور المفتاح |

### 5.3 إنشاء أو تحديث secret

```http
PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}
```

جسم الطلب:

```json
{
  "encrypted_value": "<BASE64_CRYPTO_BOX_SEAL_OUTPUT>",
  "key_id": "<KEY_ID_FROM_PUBLIC_KEY_ENDPOINT>"
}
```

الـ API لا يعيد قيمة السر أبدًا. يستطيع التطبيق قراءة قائمة الأسماء أو metadata فقط:

```http
GET /repos/{owner}/{repo}/actions/secrets
GET /repos/{owner}/{repo}/actions/secrets/{secret_name}
```

لحذف Secret عند تغيير مفتاح التوقيع:

```http
DELETE /repos/{owner}/{repo}/actions/secrets/{secret_name}
```

لا تحذف المفتاح القديم قبل التأكد من وجود نسخة احتياطية؛ فقدان نفس مفتاح توقيع التطبيق المنشور يمنع تحديثه لاحقًا.

## 6. تشغيل البناء

الـ workflow الحالي هو:

```text
.github/workflows/build-android.yml
```

تأكد من أنه يحتوي:

```yaml
on:
  workflow_dispatch:
```

### 6.1 معرفة workflow

```http
GET /repos/{owner}/{repo}/actions/workflows
GET /repos/{owner}/{repo}/actions/workflows/{workflow_id}
```

يمكن تمرير اسم الملف مباشرة بدل الرقم:

```text
build-android.yml
```

### 6.2 تشغيل workflow

```http
POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches
```

جسم الطلب المستخدم في MindBuild:

```json
{
  "ref": "main",
  "inputs": {
    "build_type": "release",
    "artifact_format": "both",
    "export_signing_material": "false",
    "use_ephemeral_signing_key": "false",
    "version_name": "1.0.0",
    "version_code": "1"
  }
}
```

القيم المتاحة:

| input | القيم | الاستخدام |
|---|---|---|
| `build_type` | `debug`, `release` | Debug لا يحتاج Release key؛ Release يحتاجه |
| `artifact_format` | `apk`, `aab`, `both` | نوع مخرج Release |
| `export_signing_material` | `true`, `false` | تنزيل keystore وmetadata عند الحاجة |
| `use_ephemeral_signing_key` | `true`, `false` | اختبار CI فقط؛ ممنوع للإنتاج |
| `version_name` | نص | `versionName` |
| `version_code` | رقم | `versionCode` |

استجابة GitHub الحديثة تعيد `workflow_run_id` و`run_url` و`html_url`. إذا أعاد الخادم استجابة فارغة، يستخدم العميل fallback يبحث عن التشغيل الجديد.

## 7. متابعة البناء والتحكم فيه

### 7.1 قائمة التشغيل أو قراءة تشغيل محدد

```http
GET /repos/{owner}/{repo}/actions/runs?event=workflow_dispatch&branch=main&per_page=20
GET /repos/{owner}/{repo}/actions/runs/{run_id}
```

الحقول المهمة:

```text
id, status, conclusion, head_sha, run_number, run_attempt,
created_at, updated_at, html_url
```

القيم المتوقعة لـ `status` تشمل `queued`, `in_progress`, و`completed`. بعد `completed` افحص `conclusion`; يجب أن تكون `success` قبل تنزيل مخرجات الإنتاج.

### 7.2 الوظائف والسجلات

```http
GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs?per_page=100
GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs
```

التطبيق يجب أن يعرض اسم الوظيفة وحالتها، ويتيح فتح السجل بعد إزالة أي نص حساس. لا تعرض السجل كاملًا تلقائيًا إذا احتوى مطور المشروع على أوامر تطبع أسرارًا بالخطأ.

### 7.3 الإلغاء وإعادة المحاولة

```http
POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel
POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun-failed-jobs
POST /repos/{owner}/{repo}/actions/runs/{run_id}/rerun
```

المحرك الحالي ينفذ الإلغاء وإعادة تشغيل jobs الفاشلة. أضف زر تأكيد قبل الإلغاء، ولا تعيد Release تلقائيًا إذا كان السبب فشل توقيع أو غياب Secret.

## 8. تنزيل APK/AAB والـ metadata

بعد نجاح التشغيل:

```http
GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts
GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}
GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip
```

رابط تنزيل artifact يعيد redirect مؤقتًا؛ نفذ التنزيل فورًا ولا تخزنه كرابط دائم. استخرج الملفات إلى مجلد خاص بالتطبيق، ثم تحقق من:

```text
SHA256SUMS.txt
APK بواسطة apksigner
AAB بواسطة jarsigner
release-signing-metadata.json
```

الـ workflow يرفع artifactين عند Release مع `export_signing_material=true`:

```text
mindbuild-release-<run_number>.zip
├── app-release.apk
├── app-release.aab
└── SHA256SUMS.txt

mindbuild-signing-material-<run_number>.zip
├── MindBuild-release-signing.jks أو .p12
└── release-signing-metadata.json
```

لا تعرض زر تثبيت أو توزيع قبل مقارنة SHA-256 والتحقق من أن `artifact.workflow_run.id` يساوي التشغيل الذي طلبه التطبيق.

لحذف artifacts بعد تسليمها:

```http
DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}
```

اضبط retention قصيرًا لمواد التوقيع، ولا ترفع keystore في نفس artifact الخاص بالتطبيق إلا إذا طلب المستخدم ذلك صراحة.

## 9. Releases اختيارية للتوزيع الدائم

Artifacts مناسبة لتنزيلات مؤقتة. إذا أردت صفحة إصدار دائمة أو رابطًا ثابتًا، استخدم Releases API بعد نجاح البناء:

```http
POST /repos/{owner}/{repo}/releases
POST /repos/{owner}/{repo}/releases/{release_id}/assets?name=app-release.apk
POST /repos/{owner}/{repo}/releases/{release_id}/assets?name=app-release.aab
PATCH /repos/{owner}/{repo}/releases/{release_id}
DELETE /repos/{owner}/{repo}/releases/{release_id}
```

لا ترفع keystore إلى Release asset. ارفع APK/AAB و`SHA256SUMS.txt` فقط. استخدم tag immutable أو تحقق من عدم وجود tag قبل إنشاء إصدار جديد.

## 10. حالات الخطأ التي يجب أن يفهمها التطبيق

| HTTP | المعنى | التصرف |
|---:|---|---|
| `401` | توكن منتهي أو غير صالح | امسح التوكن المحلي واطلب إدخاله من جديد |
| `403` | صلاحية ناقصة أو Actions/Secrets غير مفعّلة | اعرض اسم endpoint والصلاحية المطلوبة، ولا تكرر الطلب بلا نهاية |
| `404` | مستودع أو workflow أو branch غير موجود | تحقق من owner/repo/ref وخصوصية المستودع |
| `409` | تعارض Git ref أو عملية متزامنة | أعد قراءة ref ثم نفذ sync ذري جديد |
| `422` | body أو input أو SHA غير صحيح | اعرض رسالة GitHub المختصرة وسجل validation بدون الأسرار |
| `429` | Rate limit | احترم `Retry-After` أو `X-RateLimit-Reset` واستخدم backoff |
| `500/502/503` | عطل مؤقت في GitHub | أعد المحاولة بمضاعفة زمنية وحد أقصى |
| `410` | Artifact منتهي | أبلغ المستخدم أن عليه إعادة البناء |

كل طلب شبكة يجب أن يحتوي timeout، ومحاولات محدودة، وbackoff. لا تعيد رفع المشروع كاملًا تلقائيًا بعد خطأ `403` أو `422`.

## 11. مكونات التطبيق المقترحة

| طبقة | المسؤولية |
|---|---|
| File Tree | قراءة الملفات، منع `..` والمسارات المطلقة، واستبعاد `.git` وملفات الأسرار |
| Project Sync | بناء `ProjectSnapshot` ورفع atomic commit |
| Token Vault | تخزين PAT أو Installation Token في Android Keystore |
| Signing Vault | قراءة JKS/PKCS12 من Storage Access Framework وعدم نسخ كلمات المرور إلى disk |
| GitHub Client | REST calls، headers، retries، pagination، parsing، وredaction |
| Build Orchestrator | dispatch، polling، cancellation، logs، artifact selection |
| Artifact Verifier | SHA-256، `apksigner`/metadata، وفحص اسم ونوع الملف |
| UI | progress، log، حالات واضحة، وأزرار تنزيل/تثبيت/إلغاء/إعادة المحاولة |

## 12. ما هو قوي وما يجب عدم فعله

التصميم القوي يعني أن Release يفشل بوضوح عند غياب مفتاح دائم، وأن Debug لا يستطيع استخدام مفتاح Release، وأن ملف keystore لا يدخل Git أبدًا، وأن رفع المشروع يتم commit واحدًا ذريًا، وأن التطبيق لا ينزل artifact من تشغيل قديم، وأن رابط artifact المؤقت لا يُحفظ كرابط دائم.

لا تستخدم PAT كلاسيكيًا مع `repo` إذا كان Fine-grained PAT كافيًا. لا تضع التوكن داخل URL أو query string. لا تكتب كلمات المرور في `GITHUB_OUTPUT` أو logs. لا تستخدم `force push` من التطبيق. لا تشغل Release بالمفتاح المؤقت. لا تسمح لملفات المشروع بتعديل workflow الإنتاجي دون مراجعة أو branch حماية، لأن workflow يمكنه تنفيذ أوامر على runner.

## المراجع الرسمية

[1]: https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens "GitHub fine-grained token permissions"
[2]: https://docs.github.com/en/rest/repos/contents "GitHub repository contents API"
[3]: https://docs.github.com/en/rest/git/refs "Git references API"
[4]: https://docs.github.com/en/rest/actions/secrets "GitHub Actions secrets API"
[5]: https://docs.github.com/en/rest/actions/workflows "GitHub Actions workflows API"
[6]: https://docs.github.com/en/rest/actions/artifacts "GitHub Actions artifacts API"
[7]: https://docs.github.com/en/rest/checks/runs "GitHub Checks API limitations"
[8]: https://developer.android.com/privacy-and-security/keystore "Android Keystore system"
