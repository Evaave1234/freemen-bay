# Freemans Bay Beginner Badminton 报名网站

Next.js + Supabase，静态导出后部署在 Netlify。

## 文件说明
- `app/page.jsx` 网页主体（标题、提示文字、报名卡片、管理员统计）
- `app/globals.css` 样式
- `components/ZoomViewer.jsx` “找不到球馆？”的可缩放图片
- `lib/sessions.js` 场次设置（周二/周五、默认时间价格、每场 12 人）
- `lib/backend.js` 连接 Supabase；没有填环境变量时自动进入预览模式
- `public/directions.jpg` 找路图片（换图就替换这个文件，名字不变）
- `supabase/setup.sql` 数据库设置，在 Supabase SQL Editor 里运行一次

## 第一次设置
1. Supabase：在 SQL Editor 运行 `supabase/setup.sql`；在 Authentication 里建你的管理员账号，并关闭 “Allow new users to sign up”。
2. 把整个文件夹推送到 GitHub（Private 仓库）。
3. Netlify：Add new site → Import an existing project → GitHub → 选这个仓库。
   构建设置会自动读取 `netlify.toml`（Build command `npm run build`，Publish directory `out`）。
4. Netlify → Site configuration → Environment variables，添加：
   - `NEXT_PUBLIC_SUPABASE_URL` = 你的 Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = 你的 Publishable key（sb_publishable_ 开头）
   然后 Deploys → Trigger deploy → Deploy site。
   ⚠️ 不要把 Secret key / service_role key 或任何密码放进代码或环境变量。

## 以后修改
在 VS Code 改文件 → 保存 → Source Control 里 Commit → Sync Changes。Netlify 会自动重新发布。

## 本地预览（可选）
需要先安装 Node.js 20：
```
npm install
npm run dev
```
打开 http://localhost:3000 。没有 `.env.local` 时是预览模式；想连真实数据库，把 `.env.local.example` 复制成 `.env.local` 并填好。
