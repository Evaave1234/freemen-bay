# Freemans Bay Beginner Badminton 报名网站

Next.js + Supabase，静态导出后部署在 Vercel：https://freemans-bay-badminton.vercel.app

## 文件说明
- `app/page.jsx` 网页主体（标题、提示文字、报名卡片、管理员统计）
- `app/globals.css` 样式
- `components/ZoomViewer.jsx` “找不到球馆？”的可缩放图片
- `lib/sessions.js` 场次设置（周二/周五、默认时间价格、每场 12 人）
- `lib/backend.js` 连接 Supabase；没有填环境变量时自动进入预览模式
- `public/directions.jpg` 找路图片（换图就替换这个文件，名字不变）
- `supabase/setup.sql` 数据库设置，在 Supabase SQL Editor 里运行一次

## 第一次设置
1. Supabase：在 SQL Editor 运行 `supabase/setup.sql`（以后改了这个文件，整份重新运行一次即可）。
   建管理员账号：Authentication → Users → Add user → Create new user，
   Email 填 `123456@example.com`，密码自己填，勾选 “Auto Confirm User”。
   网站上登录时只需要输入账号 `123456` 和密码。数据库只认这一个账号是管理员。
   然后 Authentication → Sign In / Providers，关闭 “Allow new users to sign up”。
2. 把整个文件夹推送到 GitHub（Private 仓库）。
3. Vercel：项目名 `freemans-bay-badminton`。Settings → Environment Variables（Production）里有：
   - `NEXT_PUBLIC_SUPABASE_URL` = 你的 Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = 你的 Publishable key（sb_publishable_ 开头）
   ⚠️ 不要把 Secret key / service_role key 或任何密码放进代码或环境变量。

## 以后修改
在 VS Code 改文件 → 保存 → 在项目文件夹运行 `npx vercel deploy --prod` 发布。
改了 `supabase/setup.sql` 的话，要在 SQL Editor 里整份重新运行一次。

## 本地预览（可选）
需要先安装 Node.js 20：
```
npm install
npm run dev
```
打开 http://localhost:3000 。没有 `.env.local` 时是预览模式；想连真实数据库，把 `.env.local.example` 复制成 `.env.local` 并填好。
