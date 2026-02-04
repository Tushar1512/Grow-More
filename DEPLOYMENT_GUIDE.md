# 🚀 Deployment Guide: Deploying to the Globe

This guide will walk you through deploying your Flask Student App to **Render** (a free cloud hosting provider) using **GitHub**.

---

## 📋 Prerequisites
1.  **GitHub Account**: [Sign up here](https://github.com/join) if you don't have one.
2.  **Render Account**: [Sign up here](https://dashboard.render.com/register) using your GitHub account.
3.  **Git Installed**: Ensure Git is installed on your computer.

---

## Step 1: Push Code to GitHub

First, we need to put your code online on GitHub.

1.  **Open your folder** in VS Code or Terminal.
2.  **Initialize Git** (if not done already):
    ```bash
    git init
    ```
3.  **Add files**:
    ```bash
    git add .
    ```
4.  **Commit changes**:
    ```bash
    git commit -m "Initial commit of Student App"
    ```
5.  **Create a new Repository on GitHub**:
    *   Go to [github.com/new](https://github.com/new).
    *   Name it `student-app` (or whatever you like).
    *   **Important**: Do NOT check "Add a README", "Add .gitignore", or "Add a license". Keep it empty.
    *   Click **Create repository**.
6.  **Link and Push**:
    *   Copy the 3 lines shown under "…or push an existing repository from the command line".
    *   It will look something like this (paste this in your terminal):
    ```bash
    git remote add origin https://github.com/YOUR_USERNAME/student-app.git
    git branch -M main
    git push -u origin main
    ```

---

## Step 2: Deploy on Render

Now we connect Render to your new GitHub repository.

1.  **Go to Render Dashboard**: [dashboard.render.com](https://dashboard.render.com/).
2.  Click **New +** and select **Web Service**.
3.  **Connect GitHub**:
    *   You should see your `student-app` repo in the list.
    *   Click **Connect**.
4.  **Configure the Service**:
    *   **Name**: `my-student-app` (this will be part of your URL).
    *   **Region**: Choose the one closest to you (e.g., Singapore, Frankfurt, Oregon).
    *   **Branch**: `main`.
    *   **Root Directory**: Leave blank (since `app.py` is in the root).
    *   **Runtime**: `Python 3`.
    *   **Build Command**: `pip install -r requirements.txt` (Render should detect this automatically).
    *   **Start Command**: `gunicorn app:app`
        *   *Note: `gunicorn` is the production server, and `app:app` tells it to look for the `app` object in `app.py`.*
    *   **Instance Type**: Free.

5.  **Add Environment Variables** (Critical!):
    *   Scroll down to the "Environment Variables" section.
    *   Click **Add Environment Variable**.
    *   You need to add all the keys from your `.env` file here.
    *   **Key**: `GOOGLE_API_KEY` | **Value**: (Copy from your local .env)
    *   **Key**: `FIREBASE_API_KEY` | **Value**: (Copy from your local .env)
    *   **Key**: `FIREBASE_AUTH_DOMAIN` | **Value**: (Copy from your local .env)
    *   **Key**: `FIREBASE_PROJECT_ID` | **Value**: (Copy from your local .env)
    *   **Key**: `FIREBASE_APP_ID` | **Value**: (Copy from your local .env)

6.  **Deploy**:
    *   Click **Create Web Service**.

---

## Step 3: Wait and Visit!

Render will start building your app. It handles installing Python, installing your requirements, and starting the server.

*   Watch the logs. It might take 2-3 minutes.
*   Once you see **"Your service is live"**, look for the URL at the top (e.g., `https://my-student-app.onrender.com`).
*   Click it to see your website live on the internet! 🌍

---

### Troubleshooting
*   **ModuleNotFound Error**: Make sure you pushed `requirements.txt` and it contains all libraries.
*   **Env Var Error**: Make sure you added ALL keys from `.env` to Render's Environment Variables section.
