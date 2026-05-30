# 🏠 PropFolio — Real Estate Portfolio Manager

A full stack web app built for Indian property owners to manage their entire real estate portfolio — EMI tracking, rental income, document management, and a rule-based loan advisor. Powered by Supabase for auth, real-time database, and persistent user sessions.

---

## ✨ Features

- 🔐 User authentication — sign up, sign in, sign out (via Supabase Auth)
- 📊 Property dashboard with full portfolio overview
- 💸 EMI tracker with payment schedules
- 🏘️ Rental income management
- 📁 Document storage and management
- 🧮 Rule-based loan advisor
- ⚡ Real-time data updates — everything syncs as you fill it in
- 🗄️ Persistent data per user account

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + Vite |
| Backend | Supabase (Auth + Real-time + REST API) |
| Database | PostgreSQL via Supabase |
| Styling | Tailwind CSS |

---

## 🚀 Getting Started

Follow these steps to run the project locally on your machine.

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/your-repo-name.git
cd your-repo-name
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free account
2. Click **New Project** and fill in the details
3. Wait for the project to finish setting up (takes ~1 minute)
4. Go to **Project Settings → API**
5. Copy your **Project URL** and **anon/public key** — you'll need these in the next step

### 4. Configure environment variables

Open the `.env` file in the root of the project. It looks like this:

```env
VITE_SUPABASE_URL=your_supabase_project_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

Replace the placeholder values with your actual Supabase Project URL and anon key.

### 5. Set up the database

1. In your Supabase dashboard, go to **SQL Editor** (left sidebar)
2. Open the file `schema.sql` from this repository
3. Copy the entire SQL content
4. Paste it into the Supabase SQL Editor
5. Click **Run**

This will automatically create all the required tables, relationships, and policies in your database.

### 6. Run the app

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser. Create an account and start adding your properties.

---

## 📁 Project Structure


---

## ⚠️ Environment Variables — Important

The `.env` file is included in this repository with **empty placeholder values**. You must replace them with your own Supabase project credentials as described in Step 4 above.

**Never commit real credentials to a public repository.**

---

## 🙋‍♂️ Built by

**Arsh** — Class 12th graduate [will be doing b-tech CS(AI/ML)], building in public.

Connect with me:
- 🔗 [LinkedIn](www.linkedin.com/in/arsh-mansuri-718621339)
- 🐙 [GitHub](https://github.com/arsh-mansuri)

---

## 📄 License

MIT License — free to fork, modify, and build on top of.
