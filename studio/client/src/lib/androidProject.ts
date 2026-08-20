/** MindBuild Studio design reminder: industrial-editorial build workspace; factual Android paths, concise Arabic labels, no decorative UI in generated files. */

export type ProjectFile = { path: string; content: string | Uint8Array };

export type AndroidProjectInput = {
  appName: string;
  packageName: string;
  versionName: string;
  versionCode: number;
  icon?: Uint8Array;
  iconFileName?: string;
};

const xmlEscape = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export function validateAndroidProject(input: AndroidProjectInput) {
  if (!input.appName.trim()) throw new Error("اكتب اسم التطبيق أولًا.");
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/.test(input.packageName)) {
    throw new Error("اسم الحزمة يجب أن يكون مثل com.example.myapp وبأحرف إنجليزية صغيرة.");
  }
  if (!/^\d+(\.\d+){0,3}(-[A-Za-z0-9.]+)?$/.test(input.versionName)) {
    throw new Error("صيغة versionName غير صحيحة. مثال: 1.0.0");
  }
  if (!Number.isInteger(input.versionCode) || input.versionCode < 1) {
    throw new Error("versionCode يجب أن يكون رقمًا صحيحًا أكبر من صفر.");
  }
}

export function buildAndroidProject(input: AndroidProjectInput): ProjectFile[] {
  validateAndroidProject(input);
  const packagePath = input.packageName.replaceAll(".", "/");
  const appName = xmlEscape(input.appName.trim());
  const iconReference = input.icon ? "@drawable/app_icon" : "@drawable/ic_launcher_forge";
  const files: ProjectFile[] = [
    {
      path: "settings.gradle.kts",
      content: `pluginManagement {\n    repositories {\n        google()\n        mavenCentral()\n        gradlePluginPortal()\n    }\n}\n\ndependencyResolutionManagement {\n    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)\n    repositories {\n        google()\n        mavenCentral()\n    }\n}\n\nrootProject.name = "${input.appName.trim().replaceAll('"', "\\\"")}"\ninclude(\":app\")\n`,
    },
    {
      path: "build.gradle.kts",
      content: `plugins {\n    alias(libs.plugins.android.application) apply false\n    alias(libs.plugins.kotlin.android) apply false\n}\n`,
    },
    {
      path: "gradle.properties",
      content: "org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8\nandroid.useAndroidX=true\nkotlin.code.style=official\n",
    },
    {
      path: "gradle/libs.versions.toml",
      content: `[versions]\nagp = "8.7.3"\nkotlin = "2.0.21"\ncoreKtx = "1.15.0"\nappcompat = "1.7.0"\nmaterial = "1.12.0"\nactivity = "1.10.0"\nconstraintlayout = "2.2.0"\n\n[libraries]\nandroidx-core-ktx = { group = "androidx.core", name = "core-ktx", version.ref = "coreKtx" }\nandroidx-appcompat = { group = "androidx.appcompat", name = "appcompat", version.ref = "appcompat" }\nmaterial = { group = "com.google.android.material", name = "material", version.ref = "material" }\nandroidx-activity-ktx = { group = "androidx.activity", name = "activity-ktx", version.ref = "activity" }\nandroidx-constraintlayout = { group = "androidx.constraintlayout", name = "constraintlayout", version.ref = "constraintlayout" }\n\n[plugins]\nandroid-application = { id = "com.android.application", version.ref = "agp" }\nkotlin-android = { id = "org.jetbrains.kotlin.android", version.ref = "kotlin" }\n`,
    },
    {
      path: "app/build.gradle.kts",
      content: `plugins {\n    alias(libs.plugins.android.application)\n    alias(libs.plugins.kotlin.android)\n}\n\nval releaseStoreFile = providers.environmentVariable("RELEASE_STORE_FILE")\nval releaseStorePassword = providers.environmentVariable("RELEASE_STORE_PASSWORD")\nval releaseStoreType = providers.environmentVariable("RELEASE_STORE_TYPE")\nval releaseKeyAlias = providers.environmentVariable("RELEASE_KEY_ALIAS")\nval releaseKeyPassword = providers.environmentVariable("RELEASE_KEY_PASSWORD")\n\nandroid {\n    namespace = "${input.packageName}"\n    compileSdk = 35\n\n    defaultConfig {\n        applicationId = "${input.packageName}"\n        minSdk = 24\n        targetSdk = 35\n        versionCode = ${input.versionCode}\n        versionName = "${input.versionName}"\n    }\n\n    signingConfigs {\n        create("release") {\n            if (releaseStoreFile.isPresent) {\n                storeFile = file(releaseStoreFile.get())\n                storePassword = releaseStorePassword.orNull\n                storeType = releaseStoreType.orNull ?: "JKS"\n                keyAlias = releaseKeyAlias.orNull\n                keyPassword = releaseKeyPassword.orNull\n            }\n        }\n    }\n\n    buildTypes {\n        getByName("debug") {\n            applicationIdSuffix = ".debug"\n            versionNameSuffix = "-debug"\n        }\n        getByName("release") {\n            isMinifyEnabled = false\n            signingConfig = signingConfigs.getByName("release")\n        }\n    }\n\n    compileOptions {\n        sourceCompatibility = JavaVersion.VERSION_17\n        targetCompatibility = JavaVersion.VERSION_17\n    }\n    kotlinOptions { jvmTarget = "17" }\n}\n\ndependencies {\n    implementation(libs.androidx.core.ktx)\n    implementation(libs.androidx.appcompat)\n    implementation(libs.material)\n    implementation(libs.androidx.activity.ktx)\n    implementation(libs.androidx.constraintlayout)\n}\n`,
    },
    {
      path: "app/proguard-rules.pro",
      content: "# MindBuild Studio: add project-specific R8 / ProGuard rules here.\n",
    },
    {
      path: "app/src/main/AndroidManifest.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application\n        android:allowBackup="true"\n        android:icon="${iconReference}"\n        android:label="@string/app_name"\n        android:roundIcon="${iconReference}"\n        android:supportsRtl="true"\n        android:theme="@style/Theme.MindBuildApp">\n        <activity\n            android:name=".MainActivity"\n            android:exported="true">\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n        </activity>\n    </application>\n</manifest>\n`,
    },
    {
      path: `app/src/main/java/${packagePath}/MainActivity.kt`,
      content: `package ${input.packageName}\n\nimport android.os.Bundle\nimport androidx.activity.enableEdgeToEdge\nimport androidx.appcompat.app.AppCompatActivity\n\nclass MainActivity : AppCompatActivity() {\n    override fun onCreate(savedInstanceState: Bundle?) {\n        super.onCreate(savedInstanceState)\n        enableEdgeToEdge()\n        setContentView(R.layout.activity_main)\n    }\n}\n`,
    },
    {
      path: "app/src/main/res/layout/activity_main.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>\n<androidx.constraintlayout.widget.ConstraintLayout xmlns:android="http://schemas.android.com/apk/res/android"\n    xmlns:app="http://schemas.android.com/apk/res-auto"\n    android:layout_width="match_parent"\n    android:layout_height="match_parent"\n    android:padding="24dp">\n\n    <TextView\n        android:id="@+id/title"\n        android:layout_width="wrap_content"\n        android:layout_height="wrap_content"\n        android:text="@string/app_name"\n        android:textAppearance="@style/TextAppearance.Material3.HeadlineMedium"\n        app:layout_constraintBottom_toBottomOf="parent"\n        app:layout_constraintEnd_toEndOf="parent"\n        app:layout_constraintStart_toStartOf="parent"\n        app:layout_constraintTop_toTopOf="parent" />\n\n</androidx.constraintlayout.widget.ConstraintLayout>\n`,
    },
    {
      path: "app/src/main/res/values/strings.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="app_name">${appName}</string>\n</resources>\n`,
    },
    {
      path: "app/src/main/res/values/themes.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>\n<resources xmlns:tools="http://schemas.android.com/tools">\n    <style name="Theme.MindBuildApp" parent="Theme.Material3.DayNight.NoActionBar">\n        <item name="android:statusBarColor">@android:color/transparent</item>\n        <item name="android:navigationBarColor">@android:color/transparent</item>\n        <item name="android:windowLightStatusBar">true</item>\n    </style>\n</resources>\n`,
    },
    {
      path: "app/src/main/res/drawable/ic_launcher_forge.xml",
      content: `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp"\n    android:height="108dp"\n    android:viewportWidth="108"\n    android:viewportHeight="108">\n    <path android:fillColor="#C95F2D" android:pathData="M12,12h84v84h-84z" />\n    <path android:fillColor="#FFFFFF" android:pathData="M24,75V33h10l20,23 20,-23h10v42h-11V51L54,73 35,51v24z" />\n</vector>\n`,
    },
  ];

  if (input.icon) files.push({ path: "app/src/main/res/drawable/app_icon.png", content: input.icon });
  return files;
}

export function getTextFile(files: ProjectFile[], path: string) {
  const file = files.find((candidate) => candidate.path === path);
  return file && typeof file.content === "string" ? file.content : "";
}
