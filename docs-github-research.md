# خلاصات GitHub الرسمية لمحرك MindBuild

## الصلاحيات المؤكدة

- `Contents: Read and write` مطلوب لرفع/تحديث ملفات المشروع عبر `PUT /repos/{owner}/{repo}/contents/{path}`.
- تعديل ملفات `.github/workflows/*` يحتاج أيضًا `Workflows: Read and write`.
- `Actions: Read and write` مطلوب لتشغيل workflow، وقراءة التشغيل، وإعادة التشغيل/الإلغاء/حذف artifacts عند تفعيل هذه الوظائف.
- `Actions: Read and write` مطلوب لإدارة Repository Actions Secrets عبر `GET /repos/{owner}/{repo}/actions/secrets/public-key` و`PUT /repos/{owner}/{repo}/actions/secrets/{secret_name}`.
- `Metadata: Read-only` هو الإعداد الأساسي المطلوب لبيانات المستودع.
- `Checks` لا يمكن للمستخدم أو PAT إنشاء Check Run؛ إنشاء check runs مخصص لـ GitHub Apps. يمكن قراءة النتائج من Actions وWorkflow Runs، أو استخدام Commit Statuses عند الحاجة.

## واجهات الدورة الأساسية

1. Repository metadata: `GET /repos/{owner}/{repo}`.
2. Branch/ref: `GET /repos/{owner}/{repo}/git/ref/heads/{branch}`.
3. Project upload: `PUT /repos/{owner}/{repo}/contents/{path}` مع Base64 و`sha` عند التحديث، أو Git Data API الذري للملفات الكثيرة.
4. Public key for secrets: `GET /repos/{owner}/{repo}/actions/secrets/public-key`.
5. Secret update: `PUT /repos/{owner}/{repo}/actions/secrets/{name}` مع `encrypted_value` و`key_id`.
6. Workflow lookup: `GET /repos/{owner}/{repo}/actions/workflows` أو استخدام اسم الملف مباشرة.
7. Dispatch: `POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches` مع `ref` و`inputs`.
8. Run lookup: `GET /repos/{owner}/{repo}/actions/runs` أو `GET /repos/{owner}/{repo}/actions/runs/{run_id}`.
9. Jobs/logs: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs` و`GET /repos/{owner}/{repo}/actions/jobs/{job_id}/logs`.
10. Artifacts: `GET /repos/{owner}/{repo}/actions/runs/{run_id}/artifacts` ثم `GET /repos/{owner}/{repo}/actions/artifacts/{artifact_id}/zip`.
11. Artifact cleanup: `DELETE /repos/{owner}/{repo}/actions/artifacts/{artifact_id}`.
12. Release publishing, if enabled: `POST /repos/{owner}/{repo}/releases` ثم upload asset عبر Releases API، ويحتاج Contents + Workflows بحسب endpoint.

## ملاحظات تشغيلية

- GitHub API يستخدم `Authorization: Bearer`, و`Accept: application/vnd.github+json`، و`X-GitHub-Api-Version: 2026-03-10` في التوثيق الحالي.
- Workflow dispatch يحتاج أن يكون workflow مفعّلًا وأن يحتوي `workflow_dispatch`.
- تنزيل Artifact يعيد redirect URL مؤقتًا؛ يجب تنزيله فورًا وعدم تخزين الرابط طويلًا.
- رفع الملفات واحدًا واحدًا عبر Contents API يخلق commit لكل ملف؛ للمشاريع الكبيرة الأفضل استخدام Git Blobs/Trees/Commits/Refs لإجراء commit واحد ذري.
- `Checks API` لا ينشئه PAT؛ استخدم Actions Runs أو GitHub App إذا احتجت Checks API حقيقيًا.
