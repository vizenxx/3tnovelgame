# Supabase Story Backend Migration

这个目录记录把故事系统从 Firestore 迁移到 Supabase 的第一阶段工作。

## 当前 Supabase Project

- Project name: `3tnovelgame-prod`
- Project id/ref: `dawnkpsqhhdelxfjbjve`
- Region: `ap-southeast-1`
- URL: `https://dawnkpsqhhdelxfjbjve.supabase.co`

## 你需要准备的本机环境变量

把这些放进 `.env.local`，不要提交真实 secret：

```env
SUPABASE_URL="https://dawnkpsqhhdelxfjbjve.supabase.co"
VITE_SUPABASE_URL="https://dawnkpsqhhdelxfjbjve.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SECRET_KEY="sb_secret_..."

FIREBASE_PROJECT_ID="gen-lang-client-0934165000"
FIREBASE_SERVICE_ACCOUNT_PATH="C:\\Users\\vizen\\Desktop\\firebase-service-account.json"
FIRESTORE_EXPORT_PATH="tmp\\firestore-export.json"
```

`SUPABASE_SECRET_KEY` 和 Firebase service account JSON 都不能发到聊天里，也不能 commit。

## 迁移命令

1. 从 Firestore 导出到本机 JSON：

```bash
npm run migrate:firestore:export
```

2. 先做 Supabase 导入 dry-run，只检查准备写入的数量：

```bash
npm run migrate:supabase:dry-run
```

3. 确认数量合理后，正式导入 Supabase：

```bash
npm run migrate:supabase:import
```

## 切换故事 backend

默认仍是 Firebase，比较安全。

要让故事列表、故事详情、分享记录、作者保存等主故事 store 走 Supabase，设置：

```env
VITE_STORY_BACKEND="supabase"
```

如果线上有异常，可以改回：

```env
VITE_STORY_BACKEND="firebase"
```

## 已创建的数据表

- `stories`
- `story_chapters`
- `story_endings`
- `story_branches`
- `shared_stories`
- `user_progress`
- `story_likes`
- `story_favorites`
- `story_reports`
- `app_settings`
- `cover_generation_usage`
