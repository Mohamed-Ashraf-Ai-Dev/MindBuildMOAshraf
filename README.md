# MindBuildMOAshraf

محرك بناء Android قابل للدمج داخل تطبيق شبيه بـ **AIDE**. المستودع يحتوي على مشروع Kotlin نموذجي قابل للاستبدال، وسير GitHub Actions، وحزمة Kotlin صغيرة يتصل بها تطبيق المحرر لرفع شجرة الملفات وتشغيل البناء وتنزيل النتائج.

> **الفكرة الأساسية:** التطبيق لا يبني Android محليًا داخل الهاتف. يحتفظ بالمشروع كملفات Kotlin طبيعية، ثم يرفع نسخة المشروع إلى GitHub عبر HTTPS، ويطلق بناءً معزولًا في GitHub Actions، وبعد اكتماله ينزّل ملفات APK/AAB وملفات مواد التوقيع المطلوبة.

## ما الذي يدعمه المحرك؟

| الوظيفة | الدعم |
|---|---|
| مشروع Kotlin طبيعي بشجرة ملفات | نعم؛ كل ملف يُرفع بمساره النسبي إلى الفرع المحدد |
| Debug APK | نعم، ولا يحتاج مفتاح Release |
| Release APK | نعم، مع توقيع إلزامي |
| Release AAB | نعم، مع توقيع إلزامي |
| APK وAAB معًا | نعم من خلال اختيار `both` |
| رفع مفتاح موجود | نعم، بصيغة JKS أو PKCS12 |
| رفع مفتاح جديد | نعم؛ يُولّد خارجيًا بواسطة السكربت أو يُنشأ من التطبيق ثم يُرفع بالطريقة نفسها |
| عدم وضع المفتاح في Git | مفروض بواسطة `.gitignore` ومرحلة التحقق |
| تنزيل نتيجة البناء | نعم؛ ينزّل أرشيفات Artifacts مع checksums |
| إخراج مواد التوقيع | اختياري فقط في Release، ويُخرج keystore وملف metadata غير سريين |

## شجرة المشروع

```text
.
├── app/
│   ├── src/main/java/com/mindbuildmoashraf/app/MainActivity.kt
│   └── src/main/java/com/mindbuildmoashraf/engine/
│       ├── BuildModels.kt
│       ├── GitHubActionsClient.kt
│       ├── GitHubSecretEncryptor.kt
│       ├── MindBuildEngine.kt
│       └── SecureGitHubTokenStore.kt
├── .github/workflows/build-android.yml
├── scripts/generate-signing-material.sh
├── scripts/validate-build-engine.sh
├── scripts/verify-release.sh
└── gradlew
```

## دورة الاستخدام داخل تطبيق AIDE-like

ينفذ التطبيق الدورة التالية من طبقة العمل الخلفية، وليس من خيط واجهة المستخدم:

```text
محرر الملفات
    ↓
ProjectSnapshot
    ↓ HTTPS + GitHub token محفوظ في Android Keystore
GitHub Contents API
    ↓
workflow_dispatch
    ↓
GitHub Actions: setup Java + Android SDK + Gradle
    ↓
assembleDebug أو assembleRelease أو bundleRelease
    ↓
APK/AAB + SHA256SUMS.txt
    ↓
تطبيق Android: فك أرشيف Artifact وعرض زر تنزيل/تثبيت
```

في Release، يضيف التطبيق خطوة اختيارية قبل تشغيل البناء. يقرأ مفتاح JKS/PKCS12 من Storage Access Framework، ثم يرسل قيمة Base64 المشفّرة إلى GitHub Actions Secrets. التشفير يتم بـ Libsodium sealed box باستخدام public key الخاص بالمستودع، ولا تُرسل كلمة المرور الخام إلى GitHub API.

## دمج التوكن بأمان

لا تضع توكن GitHub في `BuildConfig` أو `SharedPreferences` النصية أو ملفات المشروع. استخدم `SecureGitHubTokenStore`، الذي يخزن التوكن مشفرًا بمفتاح محفوظ داخل Android Keystore:

```kotlin
val tokenStore = SecureGitHubTokenStore(applicationContext)
tokenStore.saveToken(userEnteredGitHubToken)

val github = GitHubActionsClient(
    tokenProvider = {
        tokenStore.readToken()
            ?: error("GitHub token is not configured")
    }
)
```

يجب تنفيذ جميع استدعاءات الشبكة في `Dispatchers.IO` أو في Worker مناسب. لا تعرض التوكن أو قيم Secrets في Logcat، ولا تُضمّنه في commit أو artifact.

## رفع مشروع Kotlin وتشغيل البناء

```kotlin
val snapshot = ProjectSnapshot(
    files = editorProjectFiles.map { file ->
        ProjectFile(path = file.relativePath, bytes = file.readBytes())
    },
    commitMessage = "Sync project from MindBuild editor"
)

val request = BuildRequest(
    owner = "Mohamed-Ashraf-Ai-Dev",
    repository = "MindBuildMOAshraf",
    branch = "main",
    buildType = BuildType.RELEASE,
    releaseFormat = ReleaseFormat.BOTH,
    exportSigningMaterial = true,
    versionName = "1.0.0",
    versionCode = 1
)

val engine = MindBuildEngine(github, filesDir)
val downloadedArchives = withContext(Dispatchers.IO) {
    engine.syncProjectAndBuild(
        snapshot = snapshot,
        request = request,
        signingMaterial = selectedSigningMaterial,
        onProgress = { message -> progressChannel.trySend(message) }
    )
}
```

الناتج الأولي هو أرشيف Artifact لكل مجموعة مخرجات. يقوم التطبيق بفك الأرشيف في مساحة خاصة، يتحقق من `SHA256SUMS.txt`، ثم يعرض الملفات للمستخدم. لا تثبّت APK إلا بعد التحقق من checksum ومن مصدر البناء المتوقع.

## رفع مفتاح توقيع موجود

يمثل التطبيق ملف المستخدم بهذه البنية:

```kotlin
val material = ReleaseSigningMaterial(
    keystoreFile = selectedFile,
    storePassword = storePasswordFromSecureInput,
    keyAlias = aliasFromSecureInput,
    keyPassword = keyPasswordFromSecureInput,
    format = "JKS" // أو "PKCS12"
)

github.uploadReleaseSigningMaterial(
    owner = "Mohamed-Ashraf-Ai-Dev",
    repository = "MindBuildMOAshraf",
    signingMaterial = material
)
```

يُرسل التطبيق خمس قيم مشفرة إلى GitHub Actions Secrets: `RELEASE_KEYSTORE_B64`، و`RELEASE_STORE_PASSWORD`، و`RELEASE_STORE_TYPE`، و`RELEASE_KEY_ALIAS`، و`RELEASE_KEY_PASSWORD`. يستخدم الـ workflow هذه القيم لإصدارات Release فقط. بناء Debug لا يقرأ أيًا منها.

## توليد مفتاح جديد

لإنشاء مفتاح جديد خارج Git:

```bash
export RELEASE_STORE_PASSWORD='ضع-كلمة-مرور-قوية-خارج-المستودع'
export RELEASE_KEY_PASSWORD='ضع-كلمة-مرور-مختلفة-إن-أمكن'
export RELEASE_KEY_ALIAS='mindbuild-release'
./scripts/generate-signing-material.sh
```

ينتج السكربت keystore وملف Base64 وملف إعدادات محليًا داخل `.mindbuild-signing/`. هذا المجلد محظور من Git. في تطبيق Android يمكن استبدال السكربت بمكوّن إنشاء يستخدم مكتبة شهادات موثوقة، ثم تمرير الناتج إلى `ReleaseSigningMaterial`.

## تشغيل GitHub Actions يدويًا أو من التطبيق

يحتوي الملف `.github/workflows/build-android.yml` على `workflow_dispatch` بالمدخلات التالية:

| المدخل | القيم | الغرض |
|---|---|---|
| `build_type` | `debug` أو `release` | اختيار نوع البناء |
| `artifact_format` | `apk` أو `aab` أو `both` | تحديد مخرج Release |
| `export_signing_material` | `true` أو `false` | تنزيل keystore وmetadata عند الحاجة فقط |
| `version_name` | نص اختياري | إصدار التطبيق |
| `version_code` | رقم اختياري | رقم البناء |

لتشغيله من واجهة التطبيق، استخدم `dispatchAndResolveBuild` ثم `waitForCompletion` ثم `listArtifacts` و`downloadArtifact`. سبب فصل هذه الخطوات أن GitHub يعيد استجابة قبول بدون رقم التشغيل مباشرة، ولذلك يبحث العميل عن التشغيل الجديد قبل البدء في الاستطلاع.

## الصلاحيات المطلوبة للتوكن

استخدم Fine-grained Personal Access Token مخصصًا للمستودع، وليس توكنًا عامًا بلا حدود. يحتاج التطبيق إلى صلاحيات الكتابة على Contents لرفع شجرة الملفات، وصلاحية Actions المناسبة لتشغيل workflow وقراءة التشغيل وArtifacts، وصلاحية إدارة Actions Secrets إذا كان المستخدم سيرفع مفتاح توقيع من داخل التطبيق. اتبع مبدأ أقل صلاحية ممكنة، ويفضل إنشاء مستودع المشروع Private قبل استخدام مفاتيح حقيقية.

## الاختبار

للفحص السريع:

```bash
./scripts/validate-build-engine.sh
./gradlew :app:assembleDebug
```

لبناء Release محليًا بعد تجهيز متغيرات التوقيع:

```bash
export RELEASE_STORE_FILE="$PWD/.mindbuild-signing/MindBuild-release-signing.jks"
export RELEASE_STORE_PASSWORD='...'
export RELEASE_STORE_TYPE='JKS'
export RELEASE_KEY_ALIAS='mindbuild-release'
export RELEASE_KEY_PASSWORD='...'
./gradlew :app:assembleRelease :app:bundleRelease
```

يمنع المحرك Release عند غياب أي قيمة من قيم التوقيع. كما يتحقق `verify-release.sh` من APK بواسطة `apksigner` ومن AAB بواسطة `jarsigner`، ثم يكتب SHA-256 لكل مخرج.

## ملاحظات أمنية مهمة

مفتاح التوقيع ليس ملفًا عاديًا؛ فقدانه يعني فقدان القدرة على تحديث التطبيق المنشور بنفس هوية التوقيع. لذلك يجب الاحتفاظ بنسخة احتياطية مشفرة خارج GitHub، وعدم تفعيل `export_signing_material` إلا عند الحاجة. الـ artifact الذي يحتوي keystore قصير العمر في هذا workflow، لكن التطبيق يجب أن ينزّله عبر HTTPS ويخزنه في مساحة خاصة، ثم يحذفه عند انتهاء دورة العمل.

التصميم الحالي يفصل بين **مفتاح GitHub API** و**مفتاح توقيع Android**. الأول محفوظ في Android Keystore ويستعمل لإدارة المستودع، والثاني يُرسل مشفرًا إلى GitHub Actions Secrets ويستعمل فقط أثناء Release. لا ينبغي أن يمتلك أي جزء من واجهة المستخدم قيمة التوقيع أو كلمات المرور أكثر من الزمن اللازم.

## مراجع

1. [GitHub REST API: Actions Secrets](https://docs.github.com/en/rest/actions/secrets)
2. [GitHub REST API: Workflow Dispatches](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event)
3. [GitHub REST API: Workflow Artifacts](https://docs.github.com/en/rest/actions/artifacts)
4. [Lazysodium Android](https://github.com/terl/lazysodium-android)
5. [Android Keystore system](https://developer.android.com/privacy-and-security/keystore)
